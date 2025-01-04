import React from 'react';
import { Card } from '@/components/suggestion';
import { toast } from 'react-hot-toast';

interface RephrasedSentencesProps {
  rephrasedSentences: string;
}

const RephrasedSentences: React.FC<RephrasedSentencesProps> = ({
  rephrasedSentences,
}) => {
  return (
    <div className='w-full mt-10'>
      {rephrasedSentences && (
        <>
          <hr />
          <h3 className='text-center text-xl mt-3 mb-5 font-semibold'>
            Rephrased Sentences
          </h3>
          {rephrasedSentences.split('\n').map((sentence, index) => {
            if (sentence.length < 7) return;
            sentence = sentence
              .replace('- ', '')
              .replace(/^\d+\.\s/gm, '')
              .replace(/"/g, '')
              .trim();
            return (
              <Card
                text={sentence}
                key={index}
                className='text-center w-full mb-5'
                onClick={() => {
                  navigator.clipboard.writeText(sentence);
                  toast('Sentence has been copied to clipboard', {
                    icon: '✂️',
                  });
                }}
              />
            );
          })}
        </>
      )}
    </div>
  );
};

export default RephrasedSentences;
