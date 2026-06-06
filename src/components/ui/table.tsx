import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface TableRootProps {
  children: ReactNode;
  className?: string;
}

function Root({ children, className }: TableRootProps) {
  return (
    <table className={cn("border-hairline w-full border-collapse border", className)}>
      {children}
    </table>
  );
}

interface TableHeaderProps {
  children: ReactNode;
  className?: string;
}

function Header({ children, className }: TableHeaderProps) {
  return <thead className={className}>{children}</thead>;
}

interface TableHeadProps {
  children: ReactNode;
  className?: string;
}

function Head({ children, className }: TableHeadProps) {
  return (
    <th
      className={cn(
        "bg-raised border-hairline text-fg-faint border-b px-3.5 py-2 text-left font-mono text-[10px] font-medium tracking-wider uppercase",
        className,
      )}
    >
      {children}
    </th>
  );
}

interface TableBodyProps {
  children: ReactNode;
  className?: string;
}

function Body({ children, className }: TableBodyProps) {
  return <tbody className={className}>{children}</tbody>;
}

interface TableRowProps {
  children: ReactNode;
  className?: string;
}

function Row({ children, className }: TableRowProps) {
  return (
    <tr
      className={cn(
        "hover:bg-raised duration-fast transition-colors [&:last-child>td]:border-b-0",
        className,
      )}
    >
      {children}
    </tr>
  );
}

interface TableCellProps {
  children: ReactNode;
  className?: string;
}

function Cell({ children, className }: TableCellProps) {
  return (
    <td className={cn("border-hairline text-fg border-b px-3.5 py-1.5 text-xs", className)}>
      {children}
    </td>
  );
}

export const Table = {
  Root,
  Header,
  Head,
  Body,
  Row,
  Cell,
};
