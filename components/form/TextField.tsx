import React, { useState } from 'react';
type Props = React.InputHTMLAttributes<HTMLTextAreaElement> & {
  className?: string;
};
export default function TextField({ className = '', onChange, value }: Props) {
  return (
    <textarea
      placeholder='Enter your sentence / phrase here'
      className={`textarea textarea-bordered textarea-md  ${className}`}
      onChange={onChange}
      value={value}
    />
  );
}
