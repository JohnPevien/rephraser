import { ButtonHTMLAttributes } from 'react';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: React.ReactNode;
};
export default function Button({ children, onClick, disabled }: Props) {
  return (
    <button className='btn w-full' onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
