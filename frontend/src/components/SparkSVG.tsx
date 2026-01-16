"use client";

import React from 'react';

/**
 * SparkSVG - ÉCUREUIL ULTRA-RÉALISTE ET RÉACTIF ⚡🐿️
 * Version améliorée avec détails professionnels
 */

interface SparkSVGProps {
  mood?: 'happy' | 'excited' | 'sad' | 'thinking' | 'encouraging' | 'sleeping' | 'helpful' | 'sarcastic' | 'proud' | 'worried' | 'playful';
  level?: number;
  accessory?: string | null;
  size?: number;
  className?: string;
}

const SparkSVG: React.FC<SparkSVGProps> = ({
  mood = 'happy',
  level = 1,
  accessory = null,
  size = 128,
  className = '',
}) => {
  const getMoodColors = () => {
    switch (mood) {
      case 'excited':
        return {
          primary: '#FF8C42',
          secondary: '#FFA500',
          accent: '#FFD700',
          belly: '#FFF8E7',
          glow: true,
        };
      case 'sad':
        return {
          primary: '#B0A090',
          secondary: '#9B8F7F',
          accent: '#7A9CB8',
          belly: '#E8E0D5',
          glow: false,
        };
      case 'thinking':
        return {
          primary: '#FF8C42',
          secondary: '#FFA500',
          accent: '#B87FCC',
          belly: '#FFF8E7',
          glow: false,
        };
      case 'sleeping':
        return {
          primary: '#C4B5A0',
          secondary: '#AFA090',
          accent: '#8B8B8B',
          belly: '#E8E0D5',
          glow: false,
        };
      default:
        return {
          primary: '#FF8C42',
          secondary: '#FFA500',
          accent: '#FFD700',
          belly: '#FFF8E7',
          glow: false,
        };
    }
  };

  const colors = getMoodColors();
  const scale = level === 1 ? 0.85 : level >= 4 ? 1.15 : 1;
  const glowIntensity = level >= 4 ? 'url(#levelGlow)' : 'none';

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`spark-svg ${className}`}
      style={{ transform: `scale(${scale})` }}
    >
      <defs>
        {/* Gradients avancés pour effet 3D */}
        <radialGradient id="bodyGradient" cx="0.35" cy="0.25">
          <stop offset="0%" stopColor={colors.secondary} stopOpacity="1" />
          <stop offset="50%" stopColor={colors.primary} stopOpacity="1" />
          <stop offset="100%" stopColor="#D67D38" stopOpacity="1" />
        </radialGradient>

        <radialGradient id="bellyGradient" cx="0.4" cy="0.3">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="70%" stopColor={colors.belly} stopOpacity="1" />
          <stop offset="100%" stopColor="#F0E6D2" stopOpacity="0.8" />
        </radialGradient>

        <radialGradient id="tailGradient" cx="0.25" cy="0.2">
          <stop offset="0%" stopColor="#FFB347" stopOpacity="1" />
          <stop offset="40%" stopColor={colors.secondary} stopOpacity="1" />
          <stop offset="100%" stopColor={colors.primary} stopOpacity="1" />
        </radialGradient>

        <radialGradient id="eyeShine" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="1" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="acornGradient" cx="0.3" cy="0.3">
          <stop offset="0%" stopColor="#A67C52" />
          <stop offset="100%" stopColor="#8B6F47" />
        </radialGradient>

        {/* Effets d'ombre et brillance */}
        <filter id="shadow">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.25" />
        </filter>

        <filter id="softShadow">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.15" />
        </filter>

        <filter id="glow">
          <feGaussianBlur stdDeviation="4" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        <filter id="levelGlow">
          <feGaussianBlur stdDeviation="6" result="coloredBlur" />
          <feFlood floodColor="#FFD700" floodOpacity="0.4" />
          <feComposite in2="coloredBlur" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>

        {/* Motif de fourrure */}
        <pattern id="furTexture" x="0" y="0" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.5" fill="#000000" opacity="0.03" />
        </pattern>

        {/* Gradient pour les verres des lunettes - teinte noire classe */}
        <linearGradient id="glassesLensGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1a1a2e" stopOpacity="0.7" />
          <stop offset="50%" stopColor="#16213e" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#1a1a2e" stopOpacity="0.7" />
        </linearGradient>

        {/* Gradient pour la monture - or rose glamour */}
        <linearGradient id="glassesFrameGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#FFD700" />
          <stop offset="25%" stopColor="#FFC0CB" />
          <stop offset="50%" stopColor="#FFD700" />
          <stop offset="75%" stopColor="#FF69B4" />
          <stop offset="100%" stopColor="#FFD700" />
        </linearGradient>
      </defs>

      {/* Aura de niveau (si niveau élevé) */}
      {level >= 4 && (
        <g className="level-aura">
          <circle cx="100" cy="100" r="90" fill="#FFD700" opacity="0.1" className="pulse-aura" />
          <circle cx="100" cy="100" r="85" fill="#FFA500" opacity="0.05" className="pulse-aura-2" />
        </g>
      )}

      {/* Queue (arrière-plan) - Plus volumineuse et détaillée */}
      <g className="tail" style={{ transformOrigin: '85px 125px' }}>
        {/* Ombre de la queue */}
        <path
          d="M 90 125 Q 75 85, 65 55 Q 60 35, 68 18 Q 76 8, 88 11 Q 98 14, 96 28 Q 92 52, 85 85 Q 80 105, 90 125 Z"
          fill="#000000"
          opacity="0.1"
          transform="translate(2, 2)"
        />

        {/* Queue principale */}
        <path
          d="M 85 125 Q 70 85, 60 55 Q 55 35, 65 18 Q 75 8, 87 11 Q 97 14, 95 28 Q 91 52, 82 85 Q 77 105, 85 125 Z"
          fill="url(#tailGradient)"
          stroke="#8B4513"
          strokeWidth="2.5"
          strokeLinejoin="round"
          filter="url(#shadow)"
          className={mood === 'excited' ? 'tail-excited' : mood === 'sad' ? 'tail-sad' : 'tail-idle'}
        />

        {/* Texture fourrure queue */}
        <path
          d="M 85 125 Q 70 85, 60 55 Q 55 35, 65 18 Q 75 8, 87 11 Q 97 14, 95 28 Q 91 52, 82 85 Q 77 105, 85 125 Z"
          fill="url(#furTexture)"
          opacity="0.3"
        />

        {/* Détails de fourrure (stries) */}
        <path d="M 72 45 Q 77 40, 82 45" stroke="#D67D38" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M 68 65 Q 73 60, 78 65" stroke="#D67D38" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M 70 85 Q 75 80, 80 85" stroke="#D67D38" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />
        <path d="M 75 100 Q 80 95, 85 100" stroke="#D67D38" strokeWidth="1.5" strokeLinecap="round" opacity="0.6" />

        {/* Brillance sur la queue */}
        <ellipse cx="75" cy="50" rx="8" ry="15" fill="#FFFFFF" opacity="0.15" transform="rotate(-30 75 50)" />
      </g>

      {/* Corps principal */}
      <ellipse
        cx="100"
        cy="125"
        rx="38"
        ry="48"
        fill="url(#bodyGradient)"
        stroke="#8B4513"
        strokeWidth="2.5"
        filter="url(#shadow)"
      />
      <ellipse
        cx="100"
        cy="125"
        rx="38"
        ry="48"
        fill="url(#furTexture)"
        opacity="0.2"
      />

      {/* Ventre blanc avec brillance */}
      <ellipse
        cx="100"
        cy="135"
        rx="24"
        ry="32"
        fill="url(#bellyGradient)"
        opacity="0.95"
      />
      <ellipse
        cx="98"
        cy="130"
        rx="18"
        ry="22"
        fill="#FFFFFF"
        opacity="0.2"
      />

      {/* Tête */}
      <circle
        cx="100"
        cy="75"
        r="34"
        fill="url(#bodyGradient)"
        stroke="#8B4513"
        strokeWidth="2.5"
        filter="url(#shadow)"
      />
      <circle
        cx="100"
        cy="75"
        r="34"
        fill="url(#furTexture)"
        opacity="0.2"
      />

      {/* Brillance sur la tête */}
      <ellipse cx="92" cy="65" rx="12" ry="16" fill="#FFFFFF" opacity="0.1" transform="rotate(-25 92 65)" />

      {/* Joues blanches avec volume */}
      <ellipse cx="85" cy="78" rx="9" ry="11" fill="#FFFFFF" opacity="0.95" filter="url(#softShadow)" />
      <ellipse cx="115" cy="78" rx="9" ry="11" fill="#FFFFFF" opacity="0.95" filter="url(#softShadow)" />
      <ellipse cx="83" cy="76" rx="5" ry="6" fill="#FFFFFF" opacity="0.5" />
      <ellipse cx="113" cy="76" rx="5" ry="6" fill="#FFFFFF" opacity="0.5" />

      {/* Museau en 3D */}
      <ellipse cx="100" cy="85" rx="14" ry="10" fill="#FFE8D6" opacity="0.8" />

      {/* Oreilles avec profondeur */}
      <g className="ears">
        {/* Oreille gauche */}
        <ellipse
          cx="80"
          cy="50"
          rx="9"
          ry="16"
          fill={colors.primary}
          stroke="#8B4513"
          strokeWidth="2"
          transform="rotate(-25 80 50)"
          filter="url(#softShadow)"
        />
        <ellipse
          cx="80"
          cy="50"
          rx="5"
          ry="10"
          fill="#FFB6C1"
          opacity="0.7"
          transform="rotate(-25 80 50)"
        />
        <ellipse
          cx="78"
          cy="48"
          rx="3"
          ry="6"
          fill="#FFFFFF"
          opacity="0.3"
          transform="rotate(-25 78 48)"
        />

        {/* Oreille droite */}
        <ellipse
          cx="120"
          cy="50"
          rx="9"
          ry="16"
          fill={colors.primary}
          stroke="#8B4513"
          strokeWidth="2"
          transform="rotate(25 120 50)"
          filter="url(#softShadow)"
        />
        <ellipse
          cx="120"
          cy="50"
          rx="5"
          ry="10"
          fill="#FFB6C1"
          opacity="0.7"
          transform="rotate(25 120 50)"
        />
        <ellipse
          cx="122"
          cy="48"
          rx="3"
          ry="6"
          fill="#FFFFFF"
          opacity="0.3"
          transform="rotate(25 122 48)"
        />
      </g>

      {/* Yeux ultra-expressifs selon mood */}
      {mood === 'sleeping' ? (
        <>
          {/* Yeux fermés avec cils */}
          <path d="M 85 68 Q 90 70, 95 68" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 105 68 Q 110 70, 115 68" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M 83 66 L 81 63" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 88 66 L 87 62" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 93 66 L 93 62" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 107 66 L 107 62" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 112 66 L 113 62" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M 117 66 L 119 63" stroke="#8B4513" strokeWidth="1.5" strokeLinecap="round" />
        </>
      ) : (
        <>
          {/* Œil gauche - Plus réaliste */}
          <ellipse cx="90" cy="68" rx="8" ry="9" fill="#FFFFFF" filter="url(#softShadow)" />
          <circle cx="90" cy="68" r="6" fill="#2C2C2C" />
          <circle cx="88" cy="68" r="5" fill="#1a1a1a" />
          <circle cx="92" cy="66" r="2.5" fill="#FFFFFF" opacity="0.9" />
          <circle cx="91" cy="69" r="1.5" fill="#FFFFFF" opacity="0.6" />

          {/* Œil droit */}
          <ellipse cx="110" cy="68" rx="8" ry="9" fill="#FFFFFF" filter="url(#softShadow)" />
          <circle cx="110" cy="68" r="6" fill="#2C2C2C" />
          <circle cx="108" cy="68" r="5" fill="#1a1a1a" />
          <circle cx="112" cy="66" r="2.5" fill="#FFFFFF" opacity="0.9" />
          <circle cx="111" cy="69" r="1.5" fill="#FFFFFF" opacity="0.6" />

          {/* Sourcils expressifs selon mood */}
          {mood === 'excited' && (
            <>
              <path d="M 83 60 Q 90 57, 97 60" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 103 60 Q 110 57, 117 60" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
          {mood === 'sad' && (
            <>
              <path d="M 83 59 Q 90 62, 97 59" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 103 59 Q 110 62, 117 59" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
          {mood === 'thinking' && (
            <>
              <path d="M 83 60 L 97 60" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 103 58 Q 110 60, 117 58" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
          {mood === 'encouraging' && (
            <>
              <path d="M 83 59 Q 90 56, 97 59" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
              <path d="M 103 59 Q 110 56, 117 59" stroke="#8B4513" strokeWidth="2.5" strokeLinecap="round" />
            </>
          )}
        </>
      )}

      {/* Nez 3D */}
      <ellipse cx="100" cy="81" rx="4.5" ry="4" fill="#8B4513" />
      <ellipse cx="99" cy="80" rx="2" ry="1.5" fill="#FFFFFF" opacity="0.4" />

      {/* Bouche selon mood avec plus de détails */}
      {mood === 'excited' ? (
        <>
          <path
            d="M 88 88 Q 100 98, 112 88"
            stroke="#8B4513"
            strokeWidth="2.5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Langue */}
          <ellipse cx="100" cy="93" rx="5" ry="3" fill="#FF6B9D" opacity="0.8" />
        </>
      ) : mood === 'sad' ? (
        <path
          d="M 88 92 Q 100 87, 112 92"
          stroke="#8B4513"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      ) : mood === 'sleeping' ? (
        <>
          <ellipse cx="100" cy="88" rx="6" ry="4" fill="#8B4513" opacity="0.3" />
          <path d="M 94 88 L 106 88" stroke="#8B4513" strokeWidth="2" strokeLinecap="round" />
        </>
      ) : (
        <path
          d="M 88 90 Q 100 95, 112 90"
          stroke="#8B4513"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />
      )}

      {/* Pattes avant avec volume */}
      <g className="arms">
        {/* Patte gauche */}
        <ellipse
          cx="75"
          cy="135"
          rx="11"
          ry="20"
          fill={colors.primary}
          stroke="#8B4513"
          strokeWidth="2"
          transform="rotate(-20 75 135)"
          filter="url(#softShadow)"
        />
        <ellipse
          cx="73"
          cy="132"
          rx="6"
          ry="12"
          fill="#FFFFFF"
          opacity="0.1"
          transform="rotate(-20 73 132)"
        />

        {/* Patte droite */}
        <ellipse
          cx="125"
          cy="135"
          rx="11"
          ry="20"
          fill={colors.primary}
          stroke="#8B4513"
          strokeWidth="2"
          transform="rotate(20 125 135)"
          filter="url(#softShadow)"
        />
        <ellipse
          cx="127"
          cy="132"
          rx="6"
          ry="12"
          fill="#FFFFFF"
          opacity="0.1"
          transform="rotate(20 127 132)"
        />

        {/* Doigts/griffes */}
        <circle cx="72" cy="150" r="2.5" fill="#8B4513" opacity="0.6" />
        <circle cx="77" cy="152" r="2.5" fill="#8B4513" opacity="0.6" />
        <circle cx="123" cy="152" r="2.5" fill="#8B4513" opacity="0.6" />
        <circle cx="128" cy="150" r="2.5" fill="#8B4513" opacity="0.6" />
      </g>

      {/* Pattes arrière */}
      <ellipse cx="85" cy="165" rx="13" ry="16" fill={colors.primary} stroke="#8B4513" strokeWidth="2" filter="url(#softShadow)" />
      <ellipse cx="115" cy="165" rx="13" ry="16" fill={colors.primary} stroke="#8B4513" strokeWidth="2" filter="url(#softShadow)" />
      <ellipse cx="83" cy="162" rx="7" ry="9" fill="#FFFFFF" opacity="0.1" />
      <ellipse cx="117" cy="162" rx="7" ry="9" fill="#FFFFFF" opacity="0.1" />

      {/* Noisette magique dans les mains */}
      <g className="acorn" transform="translate(100, 150)">
        <ellipse cx="0" cy="0" rx="7" ry="9" fill="url(#acornGradient)" stroke="#654321" strokeWidth="1.5" filter="url(#softShadow)" />
        <path d="M -7 -2 Q 0 -9, 7 -2" fill="#654321" stroke="#543210" strokeWidth="1" />
        <circle cx="0" cy="-9" r="1.5" fill="#654321" />
        <ellipse cx="-2" cy="-1" rx="2" ry="3" fill="#FFFFFF" opacity="0.2" />
        {level >= 3 && (
          <circle cx="0" cy="0" r="10" fill="none" stroke="#FFD700" strokeWidth="1" opacity="0.4" className="acorn-glow" />
        )}
      </g>

      {/* Accessoires */}
      {accessory === 'glasses' && (
        <g className="glasses">
          {/* Ombre portée glamour */}
          <ellipse cx="100" cy="78" rx="28" ry="4" fill="#000000" opacity="0.1" />

          {/* Branches des lunettes - style cat-eye glamour */}
          <path d="M 74 64 L 58 58 L 52 62" stroke="url(#glassesFrameGradient)" strokeWidth="4" fill="none" strokeLinecap="round" />
          <path d="M 126 64 L 142 58 L 148 62" stroke="url(#glassesFrameGradient)" strokeWidth="4" fill="none" strokeLinecap="round" />

          {/* Décoration dorée sur les branches */}
          <circle cx="58" cy="58" r="3" fill="#FFD700" filter="url(#glow)" />
          <circle cx="142" cy="58" r="3" fill="#FFD700" filter="url(#glow)" />

          {/* Montures cat-eye glamour */}
          <path d="M 74 56 Q 87 52, 87 68 Q 87 78, 80 78 L 74 78 Q 68 78, 68 68 Q 68 58, 74 56"
                fill="url(#glassesLensGradient)" stroke="url(#glassesFrameGradient)" strokeWidth="3" />
          <path d="M 126 56 Q 113 52, 113 68 Q 113 78, 120 78 L 126 78 Q 132 78, 132 68 Q 132 58, 126 56"
                fill="url(#glassesLensGradient)" stroke="url(#glassesFrameGradient)" strokeWidth="3" />

          {/* Pont du nez élégant */}
          <path d="M 87 65 Q 100 58, 113 65" stroke="url(#glassesFrameGradient)" strokeWidth="3" fill="none" />

          {/* Décoration centrale diamant */}
          <polygon points="100,60 103,63 100,66 97,63" fill="#FFD700" filter="url(#glow)">
            <animate attributeName="opacity" values="0.8;1;0.8" dur="1.5s" repeatCount="indefinite" />
          </polygon>

          {/* Reflets brillants sur les verres */}
          <ellipse cx="76" cy="62" rx="5" ry="4" fill="#FFFFFF" opacity="0.5" />
          <ellipse cx="124" cy="62" rx="5" ry="4" fill="#FFFFFF" opacity="0.5" />
          <ellipse cx="80" cy="72" rx="3" ry="2" fill="#FFFFFF" opacity="0.3" />
          <ellipse cx="120" cy="72" rx="3" ry="2" fill="#FFFFFF" opacity="0.3" />

          {/* Étoiles scintillantes */}
          <g className="sparkle-stars">
            <polygon points="72,55 73,57 75,57 73.5,58.5 74,61 72,59.5 70,61 70.5,58.5 69,57 71,57" fill="#FFD700" opacity="0.9">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" repeatCount="indefinite" />
              <animate attributeName="transform" values="scale(1);scale(1.2);scale(1)" dur="1s" repeatCount="indefinite" />
            </polygon>
            <polygon points="128,55 129,57 131,57 129.5,58.5 130,61 128,59.5 126,61 126.5,58.5 125,57 127,57" fill="#FFD700" opacity="0.9">
              <animate attributeName="opacity" values="0.5;1;0.5" dur="1s" begin="0.5s" repeatCount="indefinite" />
              <animate attributeName="transform" values="scale(1);scale(1.2);scale(1)" dur="1s" begin="0.5s" repeatCount="indefinite" />
            </polygon>
          </g>

          {/* Petits brillants flottants */}
          <circle cx="65" cy="52" r="1.5" fill="#FF69B4" opacity="0.8">
            <animate attributeName="cy" values="52;48;52" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="135" cy="52" r="1.5" fill="#00CED1" opacity="0.8">
            <animate attributeName="cy" values="52;48;52" dur="2s" begin="0.7s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" begin="0.7s" repeatCount="indefinite" />
          </circle>
        </g>
      )}

      {accessory === 'graduate_hat' && (
        <g className="hat" transform="translate(100, 40)">
          <rect x="-20" y="-3" width="40" height="6" fill="#2C2C2C" rx="2" filter="url(#softShadow)" />
          <polygon points="0,-16 -27,-3 27,-3" fill="#2C2C2C" filter="url(#shadow)" />
          <ellipse cx="0" cy="-3" rx="27" ry="3" fill="#1a1a1a" opacity="0.5" />
          <circle cx="17" cy="-13" r="2.5" fill="#FFD700" filter="url(#glow)" />
          <line x1="17" y1="-13" x2="22" y2="-19" stroke="#FFD700" strokeWidth="1.5" />
        </g>
      )}

      {accessory === 'crown' && (
        <g className="crown" transform="translate(100, 44)">
          <path
            d="M -16 0 L -13 -9 L -9 -3 L 0 -11 L 9 -3 L 13 -9 L 16 0 Z"
            fill="#FFD700"
            stroke="#FFA500"
            strokeWidth="2"
            filter="url(#glow)"
          />
          <circle cx="-11" cy="-7" r="2.5" fill="#FF0000" filter="url(#glow)" />
          <circle cx="0" cy="-9" r="2.5" fill="#FF0000" filter="url(#glow)" />
          <circle cx="11" cy="-7" r="2.5" fill="#FF0000" filter="url(#glow)" />
          <ellipse cx="-8" cy="-5" rx="3" ry="4" fill="#FFFFFF" opacity="0.3" />
        </g>
      )}

      {accessory === 'lightning_cape' && (
        <g className="cape" transform="translate(100, 95)">
          <path
            d="M -22 0 Q -27 18, -22 35 L -17 40 Q -12 22, 0 22 Q 12 22, 17 40 L 22 35 Q 27 18, 22 0"
            fill="#FF6B35"
            opacity="0.85"
            stroke="#FFA500"
            strokeWidth="2"
            filter="url(#shadow)"
          />
          <path d="M -6 12 L 0 22 L -4 17 L 2 28" fill="#FFD700" stroke="none" opacity="0.9" />
          <path d="M 6 12 L 0 22 L 4 17 L -2 28" fill="#FFD700" stroke="none" opacity="0.9" />
        </g>
      )}

      {/* Étincelles animées pour excited ou niveau élevé */}
      {(colors.glow || level >= 4) && (
        <g className="sparkles" opacity="0.9">
          <circle cx="55" cy="55" r="3.5" fill={colors.accent} className="sparkle-1" filter="url(#glow)">
            <animate attributeName="opacity" values="0;1;0" dur="1.5s" repeatCount="indefinite" />
            <animate attributeName="r" values="2;3.5;2" dur="1.5s" repeatCount="indefinite" />
          </circle>
          <circle cx="145" cy="65" r="3" fill={colors.accent} className="sparkle-2" filter="url(#glow)">
            <animate attributeName="opacity" values="0;1;0" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
            <animate attributeName="r" values="1.5;3;1.5" dur="1.8s" repeatCount="indefinite" begin="0.3s" />
          </circle>
          <circle cx="45" cy="105" r="2.5" fill={colors.accent} className="sparkle-3" filter="url(#glow)">
            <animate attributeName="opacity" values="0;1;0" dur="2s" repeatCount="indefinite" begin="0.6s" />
            <animate attributeName="r" values="1;2.5;1" dur="2s" repeatCount="indefinite" begin="0.6s" />
          </circle>
          <circle cx="155" cy="115" r="3.5" fill={colors.accent} className="sparkle-4" filter="url(#glow)">
            <animate attributeName="opacity" values="0;1;0" dur="1.7s" repeatCount="indefinite" begin="0.9s" />
            <animate attributeName="r" values="2;3.5;2" dur="1.7s" repeatCount="indefinite" begin="0.9s" />
          </circle>
          <circle cx="100" cy="40" r="2.5" fill={colors.accent} className="sparkle-5" filter="url(#glow)">
            <animate attributeName="opacity" values="0;1;0" dur="2.2s" repeatCount="indefinite" begin="1.2s" />
            <animate attributeName="r" values="1.5;2.5;1.5" dur="2.2s" repeatCount="indefinite" begin="1.2s" />
          </circle>
        </g>
      )}

      {/* Z Z Z pour sleeping */}
      {mood === 'sleeping' && (
        <g className="zzz" opacity="0.7">
          <text x="135" y="50" fontSize="18" fill="#8B8B8B" fontFamily="Arial, sans-serif" fontWeight="bold">
            Z
            <animate attributeName="opacity" values="0;1;1;0" dur="3s" repeatCount="indefinite" />
          </text>
          <text x="145" y="40" fontSize="15" fill="#8B8B8B" fontFamily="Arial, sans-serif" fontWeight="bold">
            Z
            <animate attributeName="opacity" values="0;1;1;0" dur="3s" repeatCount="indefinite" begin="0.5s" />
          </text>
          <text x="155" y="30" fontSize="12" fill="#8B8B8B" fontFamily="Arial, sans-serif" fontWeight="bold">
            Z
            <animate attributeName="opacity" values="0;1;1;0" dur="3s" repeatCount="indefinite" begin="1s" />
          </text>
        </g>
      )}

      {/* CSS Animations */}
      <style>
        {`
          @keyframes tail-wag {
            0%, 100% { transform: rotate(0deg); }
            25% { transform: rotate(-8deg); }
            75% { transform: rotate(8deg); }
          }

          @keyframes tail-excited {
            0%, 100% { transform: rotate(0deg); }
            20% { transform: rotate(-20deg); }
            40% { transform: rotate(20deg); }
            60% { transform: rotate(-15deg); }
            80% { transform: rotate(15deg); }
          }

          @keyframes tail-sad {
            0%, 100% { transform: rotate(0deg); }
            50% { transform: rotate(5deg); }
          }

          .tail-idle {
            animation: tail-wag 2.5s ease-in-out infinite;
          }

          .tail-excited {
            animation: tail-excited 0.7s ease-in-out infinite;
          }

          .tail-sad {
            animation: tail-sad 3.5s ease-in-out infinite;
          }

          @keyframes float {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-4px); }
          }

          @keyframes float-rotate {
            0%, 100% { transform: translateY(0px) rotate(0deg); }
            50% { transform: translateY(-4px) rotate(5deg); }
          }

          .acorn {
            animation: float-rotate 2.5s ease-in-out infinite;
          }

          @keyframes ear-twitch {
            0%, 92%, 100% { transform: rotate(0deg); }
            94% { transform: rotate(8deg); }
            96% { transform: rotate(-4deg); }
          }

          .ears {
            animation: ear-twitch 5s ease-in-out infinite;
          }

          @keyframes acorn-glow-pulse {
            0%, 100% { opacity: 0.3; r: 10; }
            50% { opacity: 0.6; r: 12; }
          }

          .acorn-glow {
            animation: acorn-glow-pulse 2s ease-in-out infinite;
          }

          @keyframes pulse-aura {
            0%, 100% { opacity: 0.1; transform: scale(1); }
            50% { opacity: 0.15; transform: scale(1.05); }
          }

          @keyframes pulse-aura-2 {
            0%, 100% { opacity: 0.05; transform: scale(1); }
            50% { opacity: 0.1; transform: scale(1.08); }
          }

          .pulse-aura {
            animation: pulse-aura 3s ease-in-out infinite;
            transform-origin: center;
          }

          .pulse-aura-2 {
            animation: pulse-aura-2 3s ease-in-out infinite 0.5s;
            transform-origin: center;
          }

          .spark-svg {
            filter: drop-shadow(0 4px 8px rgba(0,0,0,0.1));
          }

          .spark-svg:hover {
            filter: drop-shadow(0 6px 12px rgba(255,140,66,0.3));
          }
        `}
      </style>
    </svg>
  );
};

export default SparkSVG;
