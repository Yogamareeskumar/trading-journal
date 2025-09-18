import * as React from "react"
import { cn } from "../../lib/utils"

interface SelectContextType {
  value?: string;
  onValueChange?: (value: string) => void;
}

const SelectContext = React.createContext<SelectContextType | undefined>(undefined);

const Select: React.FC<{ 
  children: React.ReactNode; 
  value?: string; 
  onValueChange?: (value: string) => void 
}> = ({ children, value, onValueChange }) => {
  return (
    <SelectContext.Provider value={{ value, onValueChange }}>
      <div className="relative">
        {children}
      </div>
    </SelectContext.Provider>
  )
}

const SelectTrigger = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { children?: React.ReactNode }
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  
  return (
    <select
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-background placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      ref={ref}
      value={context?.value}
      onChange={(e) => context?.onValueChange?.(e.target.value)}
      {...props}
    >
      {children}
    </select>
  )
})
SelectTrigger.displayName = "SelectTrigger"

const SelectValue: React.FC<{ placeholder?: string }> = ({ placeholder }) => (
  <option value="" disabled>{placeholder}</option>
)

const SelectContent: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <>{children}</>
)

const SelectItem: React.FC<{ value: string; children: React.ReactNode }> = ({ value, children }) => (
  <option value={value}>{children}</option>
)

export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue }