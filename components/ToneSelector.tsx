import React from 'react';
import Select from '@/components/form/Select';

interface ToneSelectorProps {
  vibe: string;
  setVibe: (value: string) => void;
}

const ToneSelector: React.FC<ToneSelectorProps> = ({ vibe, setVibe }) => {
  return (
    <div className='flex flex-col sm:flex-row justify-between gap-5 items-center'>
      <p>Select tone:</p>
      <Select
        className='rounded w-full max-w-full sm:max-w-xs'
        onChange={(e) => setVibe(e.target.value)}
        value={vibe}
        options={[
          'Professional',
          'Conversational',
          'Humorous',
          'Empathic',
          'Academic',
          'Simple',
          'Creative',
        ]}
      />
    </div>
  );
};

export default ToneSelector;
