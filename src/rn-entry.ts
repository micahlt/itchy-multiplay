// src/web-entry.ts
import { MultiPlayKernel } from "./core/kernel";
import { MultiPlayConfig, MultiPlayEvents } from "./core/protocol";
import { TurbowarpVMEngine } from "./engines/turbowarp";

/**
 * Global entry point called by React Native via
 * webviewRef.current.injectJavaScript('window.startMultiPlayHost({...})')
 */
(window as any).startMultiPlayHost = (config: MultiPlayConfig) => {
  const checkVM = setInterval(() => {
    const vm = (window as any).vm;

    if (vm && vm.runtime && vm.runtime.ioDevices) {
      clearInterval(checkVM);

      const engine = new TurbowarpVMEngine();
      const kernel = new MultiPlayKernel(config, engine);

      kernel.host().catch((err) => {
        (window as any).ReactNativeWebView?.postMessage(
          JSON.stringify({
            type: "error",
            payload: err.message,
          })
        );
      });

      kernel.onEvent = (ev: MultiPlayEvents) => {
        (window as any).ReactNativeWebView.postMessage(JSON.stringify(ev));
      };

      (window as any).multiPlayKernel = kernel;
    }
  }, 100);
};

(window as any).ReactNativeWebView?.postMessage(
  JSON.stringify({ type: "loader-ready" })
);
