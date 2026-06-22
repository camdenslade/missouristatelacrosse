import { createContext, useCallback, useContext, useRef, useState } from "react";
import type { ReactNode } from "react";

type ConfirmFn = (message: string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(() => Promise.resolve(false));

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ message: string } | null>(null);
  const resolveRef = useRef<(value: boolean) => void>(() => {});

  const confirm = useCallback((message: string): Promise<boolean> => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setState({ message });
    });
  }, []);

  const handle = (result: boolean) => {
    setState(null);
    resolveRef.current(result);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 bg-black/40 z-[99999] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <p className="text-gray-800 text-base mb-6 whitespace-pre-wrap">{state.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => handle(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => handle(true)}
                className="px-4 py-2 rounded-lg bg-[#5E0009] text-white hover:bg-red-900 text-sm"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);
