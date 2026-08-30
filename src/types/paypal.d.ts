interface PayPalButtonsOptions {
  style?: {
    layout?: "vertical" | "horizontal";
    color?: "gold" | "blue" | "silver" | "white" | "black";
    shape?: "rect" | "pill";
    label?: "donate" | "pay" | "buynow" | "checkout" | "subscribe";
  };
  createOrder?: () => Promise<string>;
  onApprove?: (data: { orderID: string }) => void | Promise<void>;
  onError?: (err: unknown) => void;
}

interface Window {
  paypal?: {
    Buttons?: (options: PayPalButtonsOptions) => {
      render: (selector: string | HTMLElement) => Promise<void> | void;
      close?: () => void;
    };
  };
}
