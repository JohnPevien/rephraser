import { useState } from 'react';
import { Inter } from 'next/font/google';
import { TextField, Button, Select } from '@/components/form';
import { Card } from '@/components/suggestion';
import { Toaster, toast } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

function cleanUpString(str: string) {
  // Remove leading and trailing spaces, newlines, and tabs
  str = str.trim().replace(/[\n\t]/g, '');
  // Remove extra spaces between words
  str = str.replace(/\s+/g, ' ');
  str = str.toLowerCase();

  return str;
}

export default function Home() {
  const [sentence, setSentence] = useState('');
  const [vibe, setVibe] = useState('casual');
  const [rephrasedSentences, setRephrasedSentences] = useState('');
  const [loading, setLoading] = useState(false);

  const generateSentence = async (sentence: string, vibe: string) => {
    setLoading(true);
    sentence = cleanUpString(sentence);

    const response = await fetch('/api/generate', {
      method: 'POST',
      body: JSON.stringify({
        sentence,
        vibe,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(response.statusText);
    }
    const data = response.body;
    if (!data) return;
    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      setRephrasedSentences((prev) => prev + chunkValue);
    }

    setLoading(false);
  };

  return (
    <main
      className={`flex  flex-col items-center justify-start ${inter.className}`}
    >
      <Toaster
        position='top-center'
        reverseOrder={false}
        toastOptions={{ duration: 2000 }}
      />
      <div className='bg-neutral w-full h-10 md:h-20 mb-10'></div>
      <div className='max-w-prose'>
        <div className='flex  flex-col items-center justify-start py-2'>
          <header className='mb-10 md:mb-16'>
            <h1 className='text-3xl font-bold underline leading-relaxed text-center'>
              Rephraser
            </h1>
            <p>A rephraser and grammar checker app powered by OpenAI API.</p>
          </header>
          <div className='w-full flex flex-col gap-5'>
            <div>
              <TextField
                className='rounded border-2 border-neutral w-full max-w-full'
                onChange={(e) => {
                  setSentence(e.target.value);
                }}
                value={sentence}
              />
            </div>
            <div className='flex flex-row justify-between gap-5 items-center'>
              <p>Select tone:</p>
              <Select
                className='rounded'
                onChange={(e) => setVibe(e.target.value)}
                value={vibe}
                options={[
                  'casual',
                  'formal',
                  'friendly',
                  'professional',
                  'creative',
                ]}
              />
            </div>

            <Button
              onClick={() => generateSentence(sentence, vibe)}
              disabled={loading}
            >
              Rephrase
            </Button>
            <p className='text-xs text-center'></p>
          </div>

          <div className='w-full mt-10'>
            {rephrasedSentences && (
              <>
                <hr />
                <h3 className='text-center text-xl mt-3 mb-5'>
                  Rephrased Sentences
                </h3>
                {rephrasedSentences.split('\n').map((sentence, index) => {
                  if (sentence === '') return;
                  sentence = sentence.trim().replace('- ', '');
                  return (
                    <Card
                      text={sentence}
                      key={index}
                      className='text-center w-full mb-5'
                      onClick={() => {
                        navigator.clipboard.writeText(sentence);
                        toast('Sentence have been copied to clipboard', {
                          icon: '✂️',
                        });
                      }}
                    />
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
