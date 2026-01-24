// src/Men/Local/Pages/Store/components/OrderLogsModal.jsx
import { useEffect, useState } from "react";
import Modal from "../../../../../Global/Common/Modal";
import { useAuth } from "../../../../../Global/Context/AuthContext";
import API_BASE from "../../../../../Services/API";
import { getProgramInfo } from "../../../../../Services/programHelper";

type OrderLog = {
  id: string;
  orderId?: string | null;
  success?: boolean | null;
  httpStatusCode?: number | null;
  timestamp?: string | null;
  shopId?: string | null;
  errorMessage?: string | null;
  requestPayload?: string | null;
  responsePayload?: string | null;
};

type OrderLookupResponse = {
  orderId: string;
  printifyLog?: OrderLog | null;
  paymentReceipt?: {
    orderId?: string;
    payerEmail?: string | null;
    payerName?: string | null;
    amount?: number | null;
    currency?: string | null;
    payload?: string | null;
    status?: string | null;
  } | null;
};

export default function OrderLogsModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const { program } = getProgramInfo();
  const [orders, setOrders] = useState<OrderLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [lookupId, setLookupId] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupResult, setLookupResult] = useState<OrderLookupResponse | null>(null);

  useEffect(() => {
    if (isOpen && user) {
      fetchOrders();
    }
  }, [isOpen, user]);

  const fetchOrders = async () => {
    setLoading(true);
    setError(null);
    if (!user?.uid) {
      setError("User not signed in.");
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(
        `${API_BASE}/api/admin/printify/orders?userId=${user.uid}&program=${program}&limit=100`
      );

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error("Admin access required");
        }
        throw new Error(`Failed to fetch orders: ${response.status}`);
      }

      const data = (await response.json()) as OrderLog[];
      setOrders(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch order logs.";
      setError(message);
      console.error("Error fetching order logs:", err);
    } finally {
      setLoading(false);
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "N/A";
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return "Invalid date";
    }
  };

  const toggleExpand = (orderId) => {
    setExpandedOrder(expandedOrder === orderId ? null : orderId);
  };

  const formatJson = (jsonString) => {
    if (!jsonString) return "N/A";
    try {
      const parsed = JSON.parse(jsonString);
      return JSON.stringify(parsed, null, 2);
    } catch {
      return jsonString;
    }
  };

    if (!isOpen) return null;

  return (
    <Modal onClose={onClose} size="xl">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold text-[#5E0009]">Store Order Logs</h2>

        {/* Direct order lookup */}
        <div className="border border-gray-200 rounded p-3 bg-gray-50">
          <p className="font-semibold mb-2">Lookup by Order ID (PayPal)</p>
          <div className="flex flex-col md:flex-row md:items-center gap-2">
            <input
              type="text"
              value={lookupId}
              onChange={(e) => setLookupId(e.target.value)}
              placeholder="Enter order ID e.g. 49647108GM469223U"
              className="border rounded px-3 py-2 flex-1"
            />
            <button
              onClick={async () => {
                setLookupError(null);
                setLookupResult(null);
                if (!lookupId.trim()) {
                  setLookupError("Enter an order ID");
                  return;
                }
                if (!user?.uid) {
                  setLookupError("User not signed in.");
                  return;
                }
                setLookupLoading(true);
                try {
                  const res = await fetch(
                    `${API_BASE}/api/admin/printify/orders/lookup?orderId=${encodeURIComponent(
                      lookupId.trim()
                    )}&userId=${user.uid}&program=${program}`
                  );
                  if (!res.ok) {
                    const msg = res.status === 404 ? "Order not found" : `Lookup failed (${res.status})`;
                    throw new Error(msg);
                  }
                  const data = (await res.json()) as OrderLookupResponse;
                  setLookupResult(data);
                } catch (err) {
                  const msg = err instanceof Error ? err.message : "Lookup failed";
                  setLookupError(msg);
                } finally {
                  setLookupLoading(false);
                }
              }}
              className="px-4 py-2 bg-[#5E0009] text-white rounded hover:bg-red-800 disabled:opacity-50"
              disabled={lookupLoading}
            >
              {lookupLoading ? "Searching..." : "Lookup"}
            </button>
          </div>

          {lookupError && (
            <p className="text-sm text-red-600 mt-2">{lookupError}</p>
          )}

          {lookupResult && (
            <div className="mt-3 space-y-3 bg-white border rounded p-3">
              <p className="font-semibold">Order: {lookupResult.orderId}</p>

              {lookupResult.printifyLog ? (
                <div className="text-sm space-y-1">
                  <p className="font-medium">Printify Log</p>
                  <p>Status: {lookupResult.printifyLog.success ? "Success" : "Failed"}</p>
                  {lookupResult.printifyLog.httpStatusCode && (
                    <p>HTTP: {lookupResult.printifyLog.httpStatusCode}</p>
                  )}
                  {lookupResult.printifyLog.errorMessage && (
                    <p className="text-red-600">Error: {lookupResult.printifyLog.errorMessage}</p>
                  )}
                  {lookupResult.printifyLog.requestPayload && (
                    <details className="bg-gray-50 border rounded p-2">
                      <summary className="cursor-pointer">Request payload</summary>
                      <pre className="text-xs overflow-x-auto">
                        {formatJson(lookupResult.printifyLog.requestPayload)}
                      </pre>
                    </details>
                  )}
                  {lookupResult.printifyLog.responsePayload && (
                    <details className="bg-gray-50 border rounded p-2">
                      <summary className="cursor-pointer">Response payload</summary>
                      <pre className="text-xs overflow-x-auto">
                        {formatJson(lookupResult.printifyLog.responsePayload)}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No Printify log stored for this order.</p>
              )}

              {lookupResult.paymentReceipt ? (
                <div className="text-sm space-y-1">
                  <p className="font-medium">PayPal Receipt</p>
                  {lookupResult.paymentReceipt.payerEmail && (
                    <p>Email: {lookupResult.paymentReceipt.payerEmail}</p>
                  )}
                  {lookupResult.paymentReceipt.payerName && (
                    <p>Name: {lookupResult.paymentReceipt.payerName}</p>
                  )}
                  {lookupResult.paymentReceipt.amount && (
                    <p>
                      Amount: ${Number(lookupResult.paymentReceipt.amount).toFixed(2)}{" "}
                      {lookupResult.paymentReceipt.currency || ""}
                    </p>
                  )}
                  {lookupResult.paymentReceipt.status && (
                    <p>Status: {lookupResult.paymentReceipt.status}</p>
                  )}
                  {lookupResult.paymentReceipt.payload && (
                    <details className="bg-gray-50 border rounded p-2">
                      <summary className="cursor-pointer">Raw PayPal payload</summary>
                      <pre className="text-xs overflow-x-auto">
                        {formatJson(lookupResult.paymentReceipt.payload)}
                      </pre>
                    </details>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-600">No PayPal receipt stored for this order.</p>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-8 h-8 border-4 border-[#5E0009] border-t-transparent rounded-full animate-spin"></div>
            <span className="ml-3">Loading orders...</span>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded p-4 text-red-700">
            <p className="font-semibold">Error</p>
            <p>{error}</p>
            <button
              onClick={fetchOrders}
              className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Retry
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No order logs found.
          </div>
        ) : (
          <div className="space-y-2 max-h-[70vh] overflow-y-auto">
            {orders.map((order) => (
              <div
                key={order.id}
                className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-semibold text-gray-900">
                        Order: {order.orderId || "N/A"}
                      </span>
                      <span
                        className={`px-2 py-1 rounded text-xs font-medium ${
                          order.success
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {order.success ? "Success" : "Failed"}
                      </span>
                      {order.httpStatusCode && (
                        <span className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                          {order.httpStatusCode}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 space-y-1">
                      <p>
                        <span className="font-medium">Time:</span>{" "}
                        {formatTimestamp(order.timestamp)}
                      </p>
                      {order.shopId && (
                        <p>
                          <span className="font-medium">Shop ID:</span> {order.shopId}
                        </p>
                      )}
                      {order.errorMessage && (
                        <p className="text-red-600">
                          <span className="font-medium">Error:</span> {order.errorMessage}
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => toggleExpand(order.id)}
                    className="ml-4 px-3 py-1 text-sm bg-gray-200 hover:bg-gray-300 rounded"
                  >
                    {expandedOrder === order.id ? "Hide" : "Details"}
                  </button>
                </div>

                {expandedOrder === order.id && (
                  <div className="mt-4 pt-4 border-t border-gray-200 space-y-4">
                    {order.requestPayload && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Request Payload:</h4>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                          {formatJson(order.requestPayload)}
                        </pre>
                      </div>
                    )}
                    {order.responsePayload && (
                      <div>
                        <h4 className="font-semibold text-sm mb-2">Response Payload:</h4>
                        <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">
                          {formatJson(order.responsePayload)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
}


