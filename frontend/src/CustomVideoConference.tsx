import React, { useState, useRef, useEffect } from 'react';
import {
    GridLayout,
    ParticipantTile,
    ControlBar,
    useTracks
} from '@livekit/components-react';
import { Track, RemoteAudioTrack } from 'livekit-client';

function VolumeSlider({ participant }: { participant: any }) {
    const [volume, setVolume] = useState(1); // 0.0 to 1.0

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVol = parseFloat(e.target.value);
        setVolume(newVol);

        // Set volume on all remote audio tracks for this participant
        if (participant.audioTracks) {
            participant.audioTracks.forEach((pub: any) => {
                if (pub.track && pub.track instanceof RemoteAudioTrack) {
                    pub.track.setVolume(newVol);
                }
            });
        }
    };

    // Only show if it's a remote participant
    if (participant.isLocal) return null;

    return (
        <div style={{ position: 'absolute', bottom: 40, left: 10, right: 10, zIndex: 10, backgroundColor: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, opacity: 0, transition: 'opacity 0.2s' }} className="participant-controls">
            <span style={{ fontSize: 16 }}>🔊</span>
            <input
                type="range" min="0" max="1" step="0.05" value={volume}
                onChange={handleVolumeChange}
                style={{ width: '100%', cursor: 'pointer' }}
                title="User Volume"
            />
        </div>
    );
}

function FullscreenButton({ isScreenShare, tileRef }: { isScreenShare: boolean; tileRef: React.RefObject<HTMLDivElement | null> }) {
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    if (!isScreenShare) return null;

    const toggleFullscreen = async () => {
        if (!isFullscreen && tileRef.current) {
            try {
                await tileRef.current.requestFullscreen();
            } catch (err) {
                console.error("Error attempting to enable fullscreen:", err);
            }
        } else if (document.fullscreenElement) {
            await document.exitFullscreen();
        }
    };

    return (
        <button
            onClick={toggleFullscreen}
            className="participant-controls"
            style={{
                position: 'absolute', top: 10, right: 10, zIndex: 10,
                backgroundColor: 'rgba(0,0,0,0.4)', color: 'white', border: 'none',
                padding: '6px 12px', borderRadius: 4, cursor: 'pointer',
                opacity: 0, transition: 'opacity 0.2s', fontWeight: 600, fontSize: 12
            }}
        >
            {isFullscreen ? 'Minimize' : 'Full Screen'}
        </button>
    );
}

function CustomParticipantTile(props: any) {
    const { trackReference } = props;
    const participant = trackReference?.participant;
    const isScreenShare = trackReference?.source === Track.Source.ScreenShare;
    const tileRef = useRef<HTMLDivElement>(null);

    // We wrap ParticipantTile to capture the hover state and pass it down
    return (
        <div
            ref={tileRef}
            style={{ position: 'relative', width: '100%', height: '100%' }}
            onMouseEnter={(e) => {
                const controls = e.currentTarget.querySelectorAll('.participant-controls');
                controls.forEach(c => (c as HTMLElement).style.opacity = '1');
            }}
            onMouseLeave={(e) => {
                const controls = e.currentTarget.querySelectorAll('.participant-controls');
                controls.forEach(c => (c as HTMLElement).style.opacity = '0');
            }}
        >
            <ParticipantTile {...props} />

            {participant && <VolumeSlider participant={participant} />}
            <FullscreenButton isScreenShare={isScreenShare} tileRef={tileRef} />
        </div>
    );
}

export function CustomVideoConference() {
    const tracks = useTracks(
        [
            { source: Track.Source.Camera, withPlaceholder: true },
            { source: Track.Source.ScreenShare, withPlaceholder: false },
        ],
        { onlySubscribed: false },
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%', backgroundColor: '#202225' }}>
            <GridLayout tracks={tracks} style={{ flex: 1, padding: 8 }}>
                <CustomParticipantTile />
            </GridLayout>
            <ControlBar style={{ padding: '8px 16px', backgroundColor: '#2f3136' }} />
        </div>
    );
}
