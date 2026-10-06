import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
  href: string;
  children: ReactNode;
};

// Use browser navigation for critical routes while Vinext's client router is in beta.
export function NativeLink({ href, children, ...props }: Props) {
  return (
    <a href={href} {...props}>
      {children}
    </a>
  );
}

export function navigate(href: string) {
  window.location.href = href;
}
