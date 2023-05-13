type Props = {
  text: string;
  className?: string;
  onClick?: () => void;
};
export default function Card({ text, onClick, className }: Props) {
  return (
    <div
      className={`bg-white rounded-md shadow-md p-5 hover:bg-gray-200 transition cursor-copy border-2 border-gray-700 ${className}`}
      onClick={onClick}
    >
      {text}
    </div>
  );
}
