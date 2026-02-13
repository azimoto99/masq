import { render, screen } from '@testing-library/react';
import type { MeResponse } from '@masq/shared';
import { afterEach, describe, expect, it } from 'vitest';
import { TestRouter } from '../test/TestRouter';
import { HomePage } from './HomePage';

const ACTIVE_MASK_STORAGE_KEY = 'masq.activeMaskId';

const baseUser: MeResponse['user'] = {
  id: '00000000-0000-0000-0000-000000000003',
  email: 'tester@example.com',
  friendCode: 'CDEFGHJK',
  createdAt: new Date().toISOString(),
};

const baseRtcSettings: MeResponse['rtcSettings'] = {
  advancedNoiseSuppression: false,
  pushToTalkMode: 'HOLD',
  pushToTalkHotkey: 'V',
  multiPinEnabled: false,
  pictureInPictureEnabled: false,
  defaultScreenshareFps: 30,
  defaultScreenshareQuality: 'balanced',
  cursorHighlight: true,
  selectedAuraStyle: 'AURA_STYLE_BASE',
};

describe('HomePage', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it('prefers the persisted active mask when available', () => {
    const me: MeResponse = {
      user: baseUser,
      masks: [
        {
          id: '00000000-0000-0000-0000-000000000011',
          userId: baseUser.id,
          displayName: 'Mask One',
          color: '#44ddcc',
          avatarSeed: 'one-seed',
          avatarUploadId: null,
          createdAt: new Date().toISOString(),
        },
        {
          id: '00000000-0000-0000-0000-000000000022',
          userId: baseUser.id,
          displayName: 'Mask Two',
          color: '#22aaff',
          avatarSeed: 'two-seed',
          avatarUploadId: null,
          createdAt: new Date().toISOString(),
        },
      ],
      entitlements: [],
      cosmeticUnlocks: [],
      currentPlan: 'FREE',
      rtcSettings: baseRtcSettings,
      featureAccess: [],
    };

    window.localStorage.setItem(ACTIVE_MASK_STORAGE_KEY, me.masks[1].id);

    render(
      <TestRouter>
        <HomePage me={me} />
      </TestRouter>,
    );

    expect(screen.getByText('Mask Two')).toBeInTheDocument();
    expect(screen.getByText(/signed in as tester@example.com/i)).toBeInTheDocument();
  });

  it('shows onboarding hint when no masks exist', () => {
    const me: MeResponse = {
      user: baseUser,
      masks: [],
      entitlements: [],
      cosmeticUnlocks: [],
      currentPlan: 'FREE',
      rtcSettings: baseRtcSettings,
      featureAccess: [],
    };

    render(
      <TestRouter>
        <HomePage me={me} />
      </TestRouter>,
    );

    expect(screen.getByText('none selected')).toBeInTheDocument();
    expect(screen.getByText(/create a mask before joining rooms/i)).toBeInTheDocument();
  });
});
