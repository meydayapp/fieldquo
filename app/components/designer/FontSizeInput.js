// app/components/designer/FontSizeInput.js
// Ported near verbatim from `components/font-size-input.tsx`.
import { Minus, Plus } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {number} props.value
 * @param {(value: number) => void} props.onChange
 */
export function FontSizeInput({ value, onChange }) {
  const increment = () => onChange(value + 1);
  const decrement = () => onChange(value - 1);

  const handleChange = (e) => {
    const parsed = parseInt(e.target.value, 10);
    onChange(parsed);
  };

  return (
    <div className="flex items-center">
      <Button
        onClick={decrement}
        variant="outline"
        className="rounded-r-none border-r-0 p-2"
        size="icon"
      >
        <Minus className="size-4" />
      </Button>
      <Input
        onChange={handleChange}
        value={value}
        className="h-8 w-[50px] rounded-none focus-visible:ring-0 focus-visible:ring-offset-0"
      />
      <Button
        onClick={increment}
        variant="outline"
        className="rounded-l-none border-l-0 p-2"
        size="icon"
      >
        <Plus className="size-4" />
      </Button>
    </div>
  );
}
