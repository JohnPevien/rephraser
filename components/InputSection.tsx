import React from 'react';
import TextField from '@/components/form/TextField';

interface InputSectionProps {
  sentence: string;
  setSentence: (value: string) => void;
  correctGrammar: boolean;
  suggestedSentence: string;
}

const InputSection: React.FC<InputSectionProps> = ({
  sentence,
  setSentence,
  correctGrammar,
  suggestedSentence,
}) => {
  return (
    <div>
      <TextField
        className='rounded border-2 border-neutral w-full max-w-full'
        onChange={(e) => setSentence(e.target.value)}
        value={sentence}
      />

      {!correctGrammar && (
        <>
          <p className={`text-sm mt-2 `}>Suggested Sentence:</p>
          <p className='text-xs text-gray-500 mt-2'>{`${suggestedSentence}`}</p>
        </>
      )}
    </div>
  );
};

export default InputSection;
