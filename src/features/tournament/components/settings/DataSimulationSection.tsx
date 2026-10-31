import React from 'react';
import { CheckCircle2, Sparkles, Play, Trash2 } from 'lucide-react';

import { SeedingMethod } from '../../types';
import { Button, cn } from '../../../../components/ui';

interface DataSimulationSectionProps {
  seedingMethod?: SeedingMethod;
  manualSeedsCount?: number;
  qualifierCount: number;
  recordedMatchCount: number;
  hasTiers: boolean;
  simFeedback: string | null;
  onSeedQualifiers: () => void;
  onSimulate: () => void;
  onRequestDataAction: (action: 'MATCHES' | 'QUALS' | 'ALL') => void;
}

export const DataSimulationSection: React.FC<DataSimulationSectionProps> = ({
  seedingMethod = 'QUALIFIERS',
  manualSeedsCount = 0,
  qualifierCount,
  recordedMatchCount,
  hasTiers,
  simFeedback,
  onSeedQualifiers,
  onSimulate,
  onRequestDataAction,
}) => {
  const isManual = seedingMethod === 'MANUAL';
  const seedCount = isManual ? manualSeedsCount : qualifierCount;
  const hasSeeds = seedCount > 0;
  const hasRecordedMatches = recordedMatchCount > 0;

  return (
    <section className="flex flex-col gap-3.5 rounded-lg border border-line bg-surface py-4 px-5">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-line pb-2">
        <h2 className="m-0 text-lg font-bold text-fg">
          Data Management &amp; Simulation
        </h2>

        {/* Right-aligned Data Status Summary */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-sm border border-line-subtle bg-elevated py-1 px-2.5">
            <span className="text-xs font-semibold text-fg-muted">
              {isManual ? 'Registered Seeds' : 'Qualifier Attempts'}
            </span>
            <span className={cn('font-mono text-base font-extrabold', seedCount > 0 ? 'text-gold-bright' : 'text-fg-secondary')}>
              {seedCount}
            </span>
          </div>
          <div className="flex items-center gap-2 rounded-sm border border-line-subtle bg-elevated py-1 px-2.5">
            <span className="text-xs font-semibold text-fg-muted">
              Recorded Matches
            </span>
            <span className={cn('font-mono text-base font-extrabold', recordedMatchCount > 0 ? 'text-gold-bright' : 'text-fg-secondary')}>
              {recordedMatchCount}
            </span>
          </div>
        </div>
      </div>

      {/* Feedback message banner if any */}
      {simFeedback && (
        <div className="flex animate-fade-in items-center gap-2 rounded-sm border border-green-500/40 bg-green-500/12 py-2.5 px-3.5 text-caption text-green-400">
          <CheckCircle2 size={15} />
          <span>{simFeedback}</span>
        </div>
      )}

      {/* Sandbox Simulation & Maintenance Controls Grid */}
      <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3.5">
        {/* Sandbox Simulation */}
        <div className="flex flex-col gap-2 rounded-md border border-line-subtle bg-elevated py-3 px-4">
          <div>
            <div className="text-sm font-bold text-fg">
              Sandbox Simulation
            </div>
            <div className="text-xs text-fg-muted">
              {isManual ? 'Generate simulated player seeds or run full tournament matches.' : 'Seed simulated scores or run full tournament matches.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={onSeedQualifiers}
              disabled={hasSeeds || hasRecordedMatches}
              className="gap-1.5 py-1.5 px-3.5 text-caption"
              title={
                hasRecordedMatches
                  ? 'Match play has begun. Clear match scores or all tournament data to re-seed.'
                  : hasSeeds
                  ? (isManual ? 'Manual seeds have already been registered. Clear seeds to re-seed.' : 'Qualifiers have already been seeded. Clear qualifier scores to re-seed.')
                  : (isManual ? 'Generate realistic competitors and manual seed order' : 'Generate realistic competitors and qualifier attempts')
              }
            >
              <Sparkles size={14} className="text-gold-bright" />
              {isManual ? 'Generate Seeds' : 'Seed Qualifiers'}
            </Button>

            <Button
              onClick={onSimulate}
              disabled={!hasTiers || hasRecordedMatches}
              className="gap-1.5 py-1.5 px-3.5 text-caption"
              title={
                !hasTiers
                  ? 'Add at least one bracket tier first before simulating tournament matches'
                  : hasRecordedMatches
                  ? 'Match results have already been recorded. Clear match scores to simulate again.'
                  : hasSeeds
                  ? (isManual ? 'Lock brackets from current seeds and simulate all match results to champion' : 'Lock brackets from current qualifiers and simulate all match results to champion')
                  : (isManual ? 'Generate seeds, lock brackets, and simulate all tournament matches' : 'Seed qualifiers, lock brackets, and simulate all tournament matches')
              }
            >
              <Play size={14} className="text-blue-400" />
              {hasSeeds ? 'Simulate Matches' : 'Seed & Simulate'}
            </Button>
          </div>
        </div>

        {/* Data Maintenance */}
        <div className="flex flex-col gap-2 rounded-md border border-line-subtle bg-elevated py-3 px-4">
          <div>
            <div className="text-sm font-bold text-fg">
              Data Maintenance
            </div>
            <div className="text-xs text-fg-muted">
              {isManual ? 'Clear match results or registered player seeds.' : 'Clear match results or qualifier submissions.'}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => onRequestDataAction('MATCHES')}
              disabled={recordedMatchCount === 0}
              className="py-1.5 px-3 text-caption"
              title={recordedMatchCount === 0 ? 'No recorded match scores to clear' : 'Clear all recorded match scores'}
            >
              Clear Matches ({recordedMatchCount})
            </Button>

            <Button
              onClick={() => onRequestDataAction('QUALS')}
              disabled={seedCount === 0 || hasRecordedMatches}
              className="py-1.5 px-3 text-caption"
              title={
                hasRecordedMatches
                  ? 'Cannot clear qualifier data while match scores exist. Execute "Clear Matches" first.'
                  : seedCount === 0
                  ? (isManual ? 'No registered seeds to clear' : 'No qualifier scores to clear')
                  : (isManual ? 'Clear all registered player seeds' : 'Clear all qualifier submissions')
              }
            >
              {isManual ? `Clear Seeds (${seedCount})` : `Clear Quals (${seedCount})`}
            </Button>

            <Button
              variant="danger"
              onClick={() => onRequestDataAction('ALL')}
              disabled={seedCount === 0 && recordedMatchCount === 0}
              className="py-1.5 px-3 text-caption"
              title={seedCount === 0 && recordedMatchCount === 0 ? 'No data to clear' : 'Clear all tournament data'}
            >
              <Trash2 size={13} /> Clear All
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};
