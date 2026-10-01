export interface Tab {
  id: string;
  title: string;
  url: string;
  isLoading: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Basic network error reported by the native layer, if any. */
  loadError: string | null;
}