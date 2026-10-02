import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LocalHttpsCard from "./LocalHttpsCard";

const invoke = vi.fn();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: (...args: unknown[]) => invoke(...args),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(),
}));

const statusBase = {
  supported: true,
  installed: false,
  trusted: false,
  commonName: "DevBrowser Local Development CA",
  thumbprint: "",
  caCertPath: "C:\\certs\\devbrowser-ca.cer",
  caCertPemPath: "C:\\certs\\devbrowser-ca.pem",
  leafCertPath: "C:\\certs\\localhost.crt",
  leafKeyPath: "C:\\certs\\localhost.key",
  leafHosts: ["localhost", "127.0.0.1"],
};

describe("LocalHttpsCard", () => {
  beforeEach(() => {
    invoke.mockReset();
  });

  it("no renderiza nada si no hay bridge de Tauri", async () => {
    invoke.mockRejectedValue(new Error("no hay invoke"));
    const { container } = render(<LocalHttpsCard />);
    await waitFor(() => expect(invoke).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("pide confirmación antes de instalar la CA", async () => {
    invoke.mockResolvedValue(statusBase);
    render(<LocalHttpsCard />);

    const button = await screen.findByRole("button", {
      name: /generar e instalar ca/i,
    });
    fireEvent.click(button);

    // Confirmación visible, y el comando aún no se ha invocado.
    expect(
      await screen.findByRole("button", { name: /instalar de todas formas/i }),
    ).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalledWith("local_ca_install");

    fireEvent.click(
      screen.getByRole("button", { name: /instalar de todas formas/i }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("local_ca_install"),
    );
  });

  it("permite cancelar la instalación", async () => {
    invoke.mockResolvedValue(statusBase);
    render(<LocalHttpsCard />);

    fireEvent.click(
      await screen.findByRole("button", { name: /generar e instalar ca/i }),
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(invoke).not.toHaveBeenCalledWith("local_ca_install");
    expect(
      screen.getByRole("button", { name: /generar e instalar ca/i }),
    ).toBeInTheDocument();
  });

  it("muestra el estado desconfiable y deja reconfiar la CA", async () => {
    invoke.mockResolvedValue({
      ...statusBase,
      installed: true,
      trusted: false,
    });
    render(<LocalHttpsCard />);

    expect(await screen.findByText("Sin confiar")).toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: /generar e instalar ca/i }),
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /instalar de todas formas/i }),
    );
    await waitFor(() =>
      expect(invoke).toHaveBeenCalledWith("local_ca_install"),
    );
  });

  it("muestra el thumbprint y ofrece desinstalar cuando está confiable", async () => {
    invoke.mockResolvedValue({
      ...statusBase,
      installed: true,
      trusted: true,
      thumbprint: "ABC123",
    });
    render(<LocalHttpsCard />);

    expect(await screen.findByText("Confiable")).toBeInTheDocument();
    expect(screen.getByText(/ABC123/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /desinstalar ca/i }));
    await waitFor(() => expect(invoke).toHaveBeenCalledWith("local_ca_remove"));
  });

  it("deshabilita la instalación en plataformas sin soporte", async () => {
    invoke.mockResolvedValue({ ...statusBase, supported: false });
    render(<LocalHttpsCard />);

    expect(
      await screen.findByRole("button", {
        name: /solo disponible en windows/i,
      }),
    ).toBeDisabled();
  });

  it("muestra el error si la instalación falla", async () => {
    invoke.mockResolvedValue(statusBase);
    render(<LocalHttpsCard />);

    fireEvent.click(
      await screen.findByRole("button", { name: /generar e instalar ca/i }),
    );
    invoke.mockRejectedValue(new Error("certutil -addstore falló"));
    fireEvent.click(
      await screen.findByRole("button", { name: /instalar de todas formas/i }),
    );

    expect(
      await screen.findByText(/certutil -addstore falló/),
    ).toBeInTheDocument();
  });
});
