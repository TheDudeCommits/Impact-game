/** External Hagure corrected native support envelope; not active for canonical models
 * until independent pose and coupled runtime acceptance. The support window
 * includes the authored return; stopping at last-contact+.26 would switch the
 * planted legs while the interpolated native step is still recovering. */
export const HAGURE_AUTHORED_STEP_WINDOWS = {
  "Snap Bite": {
    "start": 0,
    "end": 0.5666666666666667,
    "base": 0.15,
    "cosmic": 0.24,
    "contactPlateaus": [
      [
        0.2125,
        0.2732142857142857
      ]
    ]
  },
  "Mauling Palm": {
    "start": 0,
    "end": 1.0666666666666667,
    "base": 0.29,
    "cosmic": 0.385,
    "contactPlateaus": [
      [
        0.5333333333333332,
        0.5937106918238992
      ]
    ]
  },
  "Howling Spin": {
    "start": 0,
    "end": 1.1166666666666667,
    "base": 0.08,
    "cosmic": 0.225,
    "contactPlateaus": [
      [
        0.5084821428571429,
        0.5683035714285715
      ]
    ]
  },
  "Pack of One": {
    "start": 0,
    "end": 3.783333333333333,
    "base": 0.3,
    "cosmic": 0.47,
    "contactPlateaus": [
      [
        0.40035273368606705,
        0.4604056437389771
      ],
      [
        1.0008818342151677,
        1.0609347442680777
      ],
      [
        1.5914021164021164,
        1.6514550264550265
      ],
      [
        2.191931216931217,
        2.2519841269841274
      ],
      [
        2.982627865961199,
        3.0426807760141097
      ]
    ]
  },
  "Rush 1": {
    "start": 0,
    "end": 0.5666666666666667,
    "base": 0.15,
    "cosmic": 0.24,
    "contactPlateaus": [
      [
        0.2125,
        0.2732142857142857
      ]
    ]
  },
  "Rush 2": {
    "start": 0,
    "end": 0.6833333333333333,
    "base": 0.29,
    "cosmic": 0.385,
    "contactPlateaus": [
      [
        0.32783930361863084,
        0.3872595934737033
      ]
    ]
  },
  "Rush 3": {
    "start": 0,
    "end": 0.8166666666666667,
    "base": 0.08,
    "cosmic": 0.225,
    "contactPlateaus": [
      [
        0.36120426829268293,
        0.4209603658536585
      ]
    ]
  },
  "Turnaside Hand": {
    "start": 0,
    "end": 0.7333333333333333,
    "base": 0.29,
    "cosmic": 0.385,
    "contactPlateaus": [
      [
        0.35469998300186967,
        0.4141594424613292
      ]
    ]
  },
  "Stray Cross": {
    "start": 0,
    "end": 0.85,
    "base": 0.15,
    "cosmic": 0.24,
    "contactPlateaus": [
      [
        0.33946428571428566,
        0.3994642857142857
      ]
    ]
  },
  "Howling Break": {
    "start": 0,
    "end": 1,
    "base": 0.08,
    "cosmic": 0.225,
    "contactPlateaus": [
      [
        0.45107142857142857,
        0.5110714285714285
      ]
    ]
  },
  "Feral Lunge": {
    "start": 0,
    "end": 1.1166666666666667,
    "base": 0.08,
    "cosmic": 0.225,
    "contactPlateaus": [
      [
        0.5084821428571429,
        0.5683035714285715
      ]
    ]
  },
  "Falling Maul": {
    "start": 0,
    "end": 0.9,
    "base": 0.29,
    "cosmic": 0.385,
    "contactPlateaus": [
      [
        0.4439622641509433,
        0.5039622641509434
      ]
    ]
  },
  "Moonfall Break": {
    "start": 0,
    "end": 1.05,
    "base": 0.08,
    "cosmic": 0.225,
    "contactPlateaus": [
      [
        0.475625,
        0.535625
      ]
    ]
  }
} as const;
export function hagureAuthoredContactStep(clip:string|undefined,sourceSeconds:number,cosmic:boolean){if(!clip||!Number.isFinite(sourceSeconds)||sourceSeconds<0)return 0;const row=HAGURE_AUTHORED_STEP_WINDOWS[clip as keyof typeof HAGURE_AUTHORED_STEP_WINDOWS];return row&&sourceSeconds>row.start&&sourceSeconds<row.end?(cosmic?row.cosmic:row.base):0;}
