import { ScratchLikeVirtualMachine } from "../core/protocol";

/** Implements a virtual machine compatible with TurboWarp */
export class TurbowarpVMEngine implements ScratchLikeVirtualMachine {
  private activeKeys = new Set<string>();
  private mouseButtons = new Set<number>();

  getCanvas() {
    return document.querySelector("canvas");
  }

  applyInput(data: any) {
    const vm = (window as any).vm;
    const keyboard = vm?.runtime?.ioDevices?.keyboard;
    const mouse = vm?.runtime?.ioDevices?.mouse;

    if (data.type === "keydown" || data.type === "keyup") {
      const twKey = keyboard?._keyStringToScratchKey(data.key);
      if (!twKey) return;

      if (data.type === "keydown") this.activeKeys.add(twKey);
      else this.activeKeys.delete(twKey);

      keyboard._keysPressed = Array.from(this.activeKeys);
    } else if (data.type === "mouse") {
      if (mouse) {
        mouse._scratchX = data.coords.x;
        mouse._scratchY = data.coords.y;
        if (data.key === "down") this.mouseButtons.add(0);
        else if (data.key === "up") this.mouseButtons.clear();
        mouse._buttons = Array.from(this.mouseButtons);
      }
    }
  }

  projectUsesVideo(): boolean {
    const vm = (window as any).vm;
    return (
      vm.runtime.extensionManager._loadedExtensions as Map<string, string>
    ).has("videoSensing");
  }
}
