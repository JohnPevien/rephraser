import React, { useState } from 'react';
type Props = React.InputHTMLAttributes<HTMLSelectElement> & {
  className?: string;
  options: string[];
};
export default function TextField({
  className = '',
  onChange,
  options,
  value,
}: Props) {
  return (
    <select
      className={`select select-bordered w-full ${className}`}
      onChange={onChange}
      value={value}
    >
      <option disabled value=''>
        Select an option
      </option>
      {options.map((option, index) => (
        <option value={option} key={index}>
          {option.charAt(0).toUpperCase() + option.slice(1)}
        </option>
      ))}
    </select>
  );
}
