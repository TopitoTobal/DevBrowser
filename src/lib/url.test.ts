import { describe, expect, it } from "vitest";
import { normalizeUrl, urlLabel } from "./url";

describe("normalizeUrl", () => {
  it("devuelve null para entrada vacía o solo espacios", () => {
    expect(normalizeUrl("")).toBeNull();
    expect(normalizeUrl("   ")).toBeNull();
  });

  it("convierte un puerto simple en localhost http", () => {
    expect(normalizeUrl("3000")).toBe("http://localhost:3000/");
    expect(normalizeUrl(":3000")).toBe("http://localhost:3000/");
    expect(normalizeUrl(":5173")).toBe("http://localhost:5173/");
  });

  it("rechaza puertos fuera de rango", () => {
    expect(normalizeUrl("0")).toBeNull();
    expect(normalizeUrl("70000")).toBeNull();
  });

  it("convierte host:puerto local en http", () => {
    expect(normalizeUrl("localhost:3000")).toBe("http://localhost:3000/");
    expect(normalizeUrl("192.168.1.10:8080")).toBe("http://192.168.1.10:8080/");
  });

  it("usa http para hostnames locales", () => {
    expect(normalizeUrl("localhost")).toBe("http://localhost/");
    expect(normalizeUrl("127.0.0.1")).toBe("http://127.0.0.1/");
    expect(normalizeUrl("10.0.0.5")).toBe("http://10.0.0.5/");
    expect(normalizeUrl("172.16.0.1")).toBe("http://172.16.0.1/");
    expect(normalizeUrl("172.31.255.255")).toBe("http://172.31.255.255/");
    expect(normalizeUrl("miapp.local")).toBe("http://miapp.local/");
    expect(normalizeUrl("intranet")).toBe("http://intranet/");
  });

  it("usa http para localhost IPv6 entre corchetes", () => {
    expect(normalizeUrl("[::1]:3000")).toBe("http://[::1]:3000/");
    expect(normalizeUrl("http://[::1]/")).toBe("http://[::1]/");
  });

  it("rechaza IPv6 desnudo sin corchetes", () => {
    expect(normalizeUrl("::1")).toBeNull();
  });

  it("usa https para dominios no locales", () => {
    expect(normalizeUrl("google.com")).toBe("https://google.com/");
    expect(normalizeUrl("www.example.com")).toBe("https://www.example.com/");
    expect(normalizeUrl("dev.to")).toBe("https://dev.to/");
  });

  it("respeta el esquema explícito http/https", () => {
    expect(normalizeUrl("http://example.com")).toBe("http://example.com/");
    expect(normalizeUrl("https://github.com/TopitoTobal/DevBrowser")).toBe(
      "https://github.com/TopitoTobal/DevBrowser",
    );
  });

  it("rechaza esquemas no http(s)", () => {
    expect(normalizeUrl("file:///etc/passwd")).toBeNull();
    expect(normalizeUrl("mailto:hola@ejemplo.com")).toBeNull();
    expect(normalizeUrl("ftp://example.com")).toBeNull();
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
  });

  it("maneja espacios alrededor y www", () => {
    expect(normalizeUrl("  example.com  ")).toBe("https://example.com/");
    expect(normalizeUrl("www.google.com")).toBe("https://www.google.com/");
  });
});

describe("urlLabel", () => {
  it("devuelve placeholder para URL vacía", () => {
    expect(urlLabel("")).toBe("Nueva pestaña");
  });

  it("quita el www y conserva el puerto", () => {
    expect(urlLabel("https://www.google.com/")).toBe("google.com");
    expect(urlLabel("http://localhost:3000/")).toBe("localhost:3000");
    expect(urlLabel("https://dev.to/algo")).toBe("dev.to");
  });

  it("devuelve la URL cruda si no se puede parsear", () => {
    expect(urlLabel("no-soy-una-url :::")).toBe("no-soy-una-url :::");
  });
});
