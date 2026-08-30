import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

type CartItem = {
  id: string;
  variantId?: string | number;
  price: number;
  quantity?: number;
  title?: string;
  color?: string;
  size?: string;
  image?: string;
  sku?: string;
};

type CartSetter = (
  next: CartItem[] | ((prev: CartItem[]) => CartItem[])
) => void;

type WomenCartContextValue = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  setCart: CartSetter;
  clearCart: () => void;
  totalItems: number;
};

const STORAGE_KEY = "womens-cart-v1";

const WomenCartContext = createContext<WomenCartContextValue | null>(null);

export function WomenCartProvider({ children }: { children: ReactNode }) {
  const [cart, setCartState] = useState<CartItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setCartState(parsed);
        }
      }
    } catch (err) {
      console.warn("Failed to read women's cart from storage", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.warn("Failed to persist women's cart", err);
    }
  }, [cart, hydrated]);

  const setCart: CartSetter = (next) => {
    setCartState((prev) => {
      const updated = typeof next === "function" ? next(prev) : next;
      return Array.isArray(updated) ? updated : [];
    });
  };

  const addToCart = (product: CartItem) => {
    setCart((prev) => {
      const existing = prev.find(
        (item) => item.id === product.id && item.variantId === product.variantId
      );

      if (existing) {
        return prev.map((item) =>
          item.id === product.id && item.variantId === product.variantId
            ? { ...item, quantity: (item.quantity || 1) + 1 }
            : item
        );
      }

      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const value = useMemo(
    () => ({
      cart,
      addToCart,
      setCart,
      clearCart: () => setCartState([]),
      totalItems: cart.reduce((sum, item) => sum + (item.quantity || 1), 0),
    }),
    [cart]
  );

  return <WomenCartContext.Provider value={value}>{children}</WomenCartContext.Provider>;
}

export function useWomenCart() {
  const ctx = useContext(WomenCartContext);
  if (!ctx) {
    throw new Error("useWomenCart must be used within a WomenCartProvider");
  }
  return ctx;
}
