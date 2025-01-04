import { useReducer } from 'react';
import { Inter } from 'next/font/google';
import { Toaster, toast } from 'react-hot-toast';
import Head from 'next/head';
import Header from '@/components/Header';
import InputSection from '@/components/InputSection';
import ToneSelector from '@/components/ToneSelector';
import RephrasedSentences from '@/components/RephrasedSentences';
import Footer from '@/components/Footer';
import { Button } from '@/components/form';
import { cleanUpString } from '@/utils/string';

const inter = Inter({ subsets: ['latin'] });

interface State {
  sentence: string;
  vibe: string;
  rephrasedSentences: string;
  loading: boolean;
  correctGrammar: boolean;
  suggestedSentence: string;
}

type Action =
  | { type: 'SET_SENTENCE'; payload: string }
  | { type: 'SET_VIBE'; payload: string }
  | { type: 'SET_REPHRASED_SENTENCES'; payload: string }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_CORRECT_GRAMMAR'; payload: boolean }
  | { type: 'SET_SUGGESTED_SENTENCE'; payload: string }
  | { type: 'RESET' };

const initialState: State = {
  sentence: '',
  vibe: 'casual',
  rephrasedSentences: '',
  loading: false,
  correctGrammar: true,
  suggestedSentence: '',
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_SENTENCE':
      return { ...state, sentence: action.payload };
    case 'SET_VIBE':
      return { ...state, vibe: action.payload };
    case 'SET_REPHRASED_SENTENCES':
      return { ...state, rephrasedSentences: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_CORRECT_GRAMMAR':
      return { ...state, correctGrammar: action.payload };
    case 'SET_SUGGESTED_SENTENCE':
      return { ...state, suggestedSentence: action.payload };
    case 'RESET':
      return initialState;
    default:
      throw new Error();
  }
}

export default function Home() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const generateSentence = async (sentence: string, vibe: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_CORRECT_GRAMMAR', payload: true });
    dispatch({ type: 'SET_SUGGESTED_SENTENCE', payload: '' });
    sentence = cleanUpString(sentence);

    dispatch({ type: 'SET_REPHRASED_SENTENCES', payload: '' });

    const grammarCheck = await checkGrammar(sentence);
    const isGrammaticallyCorrect = grammarCheck?.grammarCheck === 'true';
    const suggestedSentence = grammarCheck?.suggestedSentence;

    if (!isGrammaticallyCorrect) {
      dispatch({ type: 'SET_CORRECT_GRAMMAR', payload: false });
      dispatch({
        type: 'SET_SUGGESTED_SENTENCE',
        payload: suggestedSentence || '',
      });
    }

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
      toast('An error occured, please try again.', {
        icon: '⛔',
      });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
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
      dispatch({
        type: 'SET_REPHRASED_SENTENCES',
        payload: state.rephrasedSentences + chunkValue,
      });
    }

    dispatch({ type: 'SET_LOADING', payload: false });
  };

  const tryAgain = () => {
    dispatch({ type: 'RESET' });
  };

  const checkGrammar = async (sentence: string) => {
    const response = await fetch('/api/checkgrammar', {
      method: 'POST',
      body: JSON.stringify({
        sentence,
        vibe: state.vibe,
      }),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      toast('An error occured, please try again.', {
        icon: '⛔',
      });
      dispatch({ type: 'SET_LOADING', payload: false });
      return;
    }
    const data = response.body;
    if (!data) return;
    const reader = data.getReader();
    const decoder = new TextDecoder();
    let done = false;
    let text = '';

    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      const chunkValue = decoder.decode(value);
      text += chunkValue;
    }

    const newlineIndex = text.indexOf('\n');
    const grammarCheckString = text.substring(0, newlineIndex);
    const suggestedSentenceString = text.substring(newlineIndex + 1);

    const grammarCheck = grammarCheckString
      .toLowerCase()
      .replace('grammarcheck:', '')
      .replace(/"/g, '')
      .trim();
    const suggestedSentence = suggestedSentenceString
      .replace('suggestedsentence:', '')
      .replace(/"/g, '')
      .trim();

    return { grammarCheck, suggestedSentence };
  };

  return (
    <>
      <Head>
        <title>Rephraser</title>
      </Head>
      <main
        className={`flex flex-col items-center min-h-[90vh] justify-start ${inter.className}`}
      >
        <Toaster
          position='top-center'
          reverseOrder={false}
          toastOptions={{ duration: 2000 }}
        />
        <div className='bg-neutral w-full h-10 md:h-20 mb-10'></div>
        <div className='max-w-prose px-8 md:px-0'>
          <div className='flex flex-col items-center justify-start py-2'>
            <Header
              title='Rephraser'
              description='A rephraser and grammar checker app powered by OpenAI API.'
            />

            <div className='w-full flex flex-col gap-5'>
              <InputSection
                sentence={state.sentence}
                setSentence={(value) =>
                  dispatch({ type: 'SET_SENTENCE', payload: value })
                }
                correctGrammar={state.correctGrammar}
                suggestedSentence={state.suggestedSentence}
              />
              <ToneSelector
                vibe={state.vibe}
                setVibe={(value) =>
                  dispatch({ type: 'SET_VIBE', payload: value })
                }
              />
              {!state.rephrasedSentences ? (
                <Button
                  onClick={() => generateSentence(state.sentence, state.vibe)}
                  disabled={
                    state.loading ||
                    !state.sentence ||
                    state.sentence.length < 7
                  }
                >
                  Rephrase
                </Button>
              ) : (
                <Button onClick={tryAgain}>Try again</Button>
              )}

              <p className='text-xs text-center'></p>
            </div>

            <RephrasedSentences rephrasedSentences={state.rephrasedSentences} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
