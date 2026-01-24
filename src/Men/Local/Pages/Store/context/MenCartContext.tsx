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
};

type CartSetter = (
  next: CartItem[] | ((prev: CartItem[]) => CartItem[])
) => void;

type MenCartContextValue = {
  cart: CartItem[];
  addToCart: (item: CartItem) => void;
  setCart: CartSetter;
  clearCart: () => void;
  totalItems: number;
};

const STORAGE_KEY = "mens-cart-v1";

const MenCartContext = createContext<MenCartContextValue | null>(null);

export function MenCartProvider({ children }: { children: ReactNode }) {
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
      console.warn("Failed to read men's cart from storage", err);
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cart));
    } catch (err) {
      console.warn("Failed to persist men's cart", err);
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

  return <MenCartContext.Provider value={value}>{children}</MenCartContext.Provider>;
}

export function useMenCart() {
  const ctx = useContext(MenCartContext);
  if (!ctx) {
    throw new Error("useMenCart must be used within a MenCartProvider");
  }
  return ctx;
}
