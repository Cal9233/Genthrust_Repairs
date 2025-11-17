/**
 * ROTable - Repair Order Table Component
 *
 * This file now serves as a re-export of the refactored ROTable component.
 * The component has been split into compound components for better maintainability:
 *
 * - ROTable/index.tsx: Main composition component
 * - ROTable/TableFilters.tsx: Search, view selector, and filter buttons
 * - ROTable/TableHeader.tsx: Sortable table header with columns
 * - ROTable/TableBody.tsx: Table body that maps ROs to rows
 * - ROTable/TableRow.tsx: Individual RO row with expandable details
 * - ROTable/TablePagination.tsx: Pagination controls
 * - ROTable/types.ts: Shared TypeScript types
 *
 * The original 836-line component has been preserved as ROTable.old.tsx
 */

export { ROTable } from "./ROTable/index";
