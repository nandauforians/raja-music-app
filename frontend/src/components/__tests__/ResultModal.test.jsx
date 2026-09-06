import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResultModal from '../ResultModal';

describe('ResultModal Component', () => {
  const mockSong = { id: 'song1', title: 'Test Song' };

  it('renders nothing if challengeScore is null', () => {
    const { container } = render(
      <ResultModal challengeScore={null} song={mockSong} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders recording finished state when score is undefined', () => {
    const challengeScore = { audioUrl: 'blob:http://test' };
    render(
      <ResultModal challengeScore={challengeScore} song={mockSong} />
    );
    expect(screen.getByText('Recording Finished!')).toBeInTheDocument();
    expect(screen.getByText('Get AI Evaluation')).toBeInTheDocument();
  });

  it('renders score when it exists', () => {
    const challengeScore = { score: 85, feedback: 'Great job!', audioUrl: 'blob:test' };
    render(
      <ResultModal challengeScore={challengeScore} song={mockSong} />
    );
    expect(screen.getByText('You Scored')).toBeInTheDocument();
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText(/"Great job!"/)).toBeInTheDocument();
  });

  it('calls handleSaveRecording when save button clicked', () => {
    const challengeScore = { score: 85, feedback: 'Great job!', audioUrl: 'blob:test' };
    const handleSaveRecording = vi.fn();
    render(
      <ResultModal 
        challengeScore={challengeScore} 
        song={mockSong} 
        user={{ sub: 'user1' }}
        handleSaveRecording={handleSaveRecording}
      />
    );
    fireEvent.click(screen.getByText('Save to Profile'));
    expect(handleSaveRecording).toHaveBeenCalled();
  });
});
