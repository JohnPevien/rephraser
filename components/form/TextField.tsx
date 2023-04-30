import {useState} from 'react'
type Props = {
  className?: string;
}
export default function TextField({className=""}: Props) {
  const [value, setValue] = useState('');
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value)
  }
  return (
    <textarea placeholder="Enter your sentence / phrase here" className={`textarea textarea-bordered textarea-md  ${className}`} onChange={handleChange} >{value}</textarea>
    
  )
}