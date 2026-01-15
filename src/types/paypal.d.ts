interface Window {
  paypal?: {
    Buttons?: (options: Record<string, unknown>) => {
      render: (selector: string | HTMLElement) => Promise<void> | void;
      close?: () => void;
    };
  };
}
