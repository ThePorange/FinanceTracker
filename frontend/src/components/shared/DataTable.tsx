import type { ReactNode } from 'react';

interface DataTableProps {
  headers: ReactNode[];
  children: ReactNode;
  isLoading?: boolean;
}

export function DataTable({ headers, children, isLoading }: DataTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm w-full">
      <table className="w-full text-sm text-left">
        <thead className="bg-gray-50 text-gray-700 font-medium">
          <tr>
            {headers.map((h, i) => (
              <th key={i} className="px-4 py-3 border-b border-gray-200 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {isLoading ? (
            <tr>
              <td colSpan={headers.length} className="px-4 py-8 text-center text-gray-400">
                Loading data...
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}
