import { useState, useCallback, useRef } from "react";

const STORAGE_KEY = "flexa_pos_printer_type";

// Detect which connection types the current browser supports.
export function getSupportedTypes() {
  const types = [];
  if (typeof navigator !== "undefined") {
    if (navigator.usb) types.push("usb");
    if (navigator.bluetooth) types.push("bluetooth");
    if (navigator.serial) types.push("serial");
  }
  return types;
}

export function usePrinterConnection() {
  const supported = getSupportedTypes();
  const saved = localStorage.getItem(STORAGE_KEY);

  const [connectionType, setConnectionType] = useState(
    () => (supported.includes(saved) ? saved : supported[0] || "usb"),
  );
  const [status, setStatus] = useState("disconnected"); // disconnected | connecting | connected
  const [deviceName, setDeviceName] = useState("");

  const printerRef = useRef(null);

  const connect = useCallback(
    async (type = connectionType) => {
      if (status === "connecting") return;

      setStatus("connecting");
      try {
        let PrinterClass;
        if (type === "bluetooth") {
          const mod = await import("@point-of-sale/webbluetooth-receipt-printer");
          PrinterClass = mod.default;
        } else if (type === "usb") {
          const mod = await import("@point-of-sale/webusb-receipt-printer");
          PrinterClass = mod.default;
        } else if (type === "serial") {
          const mod = await import("@point-of-sale/webserial-receipt-printer");
          PrinterClass = mod.default;
        } else {
          throw new Error(`Unknown printer type: ${type}`);
        }
        const printer = new PrinterClass();

        // Disconnect previous printer if any
        if (printerRef.current) {
          try {
            printerRef.current.disconnect?.();
          } catch (_) {}
          printerRef.current = null;
        }

        await new Promise((resolve, reject) => {
          const onConnected = (device) => {
            printerRef.current = printer;
            setDeviceName(device?.name || "Printer");
            setConnectionType(type);
            localStorage.setItem(STORAGE_KEY, type);
            setStatus("connected");
            resolve();
          };

          printer.addEventListener("connected", onConnected, { once: true });

          printer.addEventListener(
            "disconnected",
            () => {
              printerRef.current = null;
              setStatus("disconnected");
              setDeviceName("");
            },
            { once: true },
          );

          const connectResult = printer.connect();
          // connect() may return a Promise that rejects on user cancel
          if (connectResult && typeof connectResult.catch === "function") {
            connectResult.catch((err) => {
              printer.removeEventListener("connected", onConnected);
              reject(err);
            });
          }

          // Safety timeout so the hook doesn't hang if no event fires
          setTimeout(
            () => reject(new Error("Connection timed out — no device selected")),
            45_000,
          );
        });
      } catch (err) {
        setStatus("disconnected");
        throw err;
      }
    },
    [connectionType, status],
  );

  const disconnect = useCallback(() => {
    if (printerRef.current) {
      try {
        printerRef.current.disconnect?.();
      } catch (_) {}
      printerRef.current = null;
    }
    setStatus("disconnected");
    setDeviceName("");
  }, []);

  const print = useCallback((data) => {
    if (!printerRef.current) throw new Error("Printer not connected");
    printerRef.current.print(data);
  }, []);

  const changeType = useCallback(
    (type) => {
      if (status === "connected") disconnect();
      setConnectionType(type);
      localStorage.setItem(STORAGE_KEY, type);
    },
    [status, disconnect],
  );

  return {
    supported,
    connectionType,
    status,
    deviceName,
    isConnected: status === "connected",
    isConnecting: status === "connecting",
    connect,
    disconnect,
    print,
    changeType,
  };
}
