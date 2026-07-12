import type { ReactNode } from "react";

type PagePlaceholderProps = {
  title: string;
  description: string;
  children?: ReactNode;
};

export function PagePlaceholder({
  title,
  description,
  children,
}: PagePlaceholderProps) {
  return (
    <section aria-labelledby="page-title" className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">
          Scaffold placeholder
        </p>
        <h1
          id="page-title"
          className="text-3xl font-bold tracking-tight text-slate-950"
        >
          {title}
        </h1>
        <p className="max-w-2xl text-base leading-7 text-slate-600">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}
