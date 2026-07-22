"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Global toast host. Mounted once in Providers; call the `toast()` API from anywhere. */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "!bg-popover !text-popover-foreground !border-border !shadow-lg !rounded-xl",
          description: "!text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
