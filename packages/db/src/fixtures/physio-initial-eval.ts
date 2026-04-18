import type { TemplateContentV2 } from '@careos/api-contract'

/**
 * Physio initial evaluation template (IAF v0.2)
 * 4 pages, 50+ fields, bilingual fr/en
 * Based on ClinicMaster template analysis
 */
export const physioInitialEval: TemplateContentV2 = {
  schemaVersion: '0.3',
  locale: ['fr', 'en'],
  pages: [
    // ── Page 1: Patient History ──
    {
      key: 'history',
      label: { fr: 'Histoire du patient', en: 'Patient History' },
      sections: [
        {
          key: 'referral',
          label: { fr: 'Référence', en: 'Referral' },
          rows: [
            {
              columns: [
                {
                  key: 'referring_md',
                  label: { fr: 'Médecin référant', en: 'Referring Physician' },
                  type: 'text',
                  required: false,
                  config: { placeholder: { fr: 'Nom du médecin', en: 'Physician name' } },
                },
                {
                  key: 'referral_date',
                  label: { fr: 'Date de référence', en: 'Referral Date' },
                  type: 'date',
                  required: false,
                  config: {},
                },
              ],
            },
            {
              columns: [
                {
                  key: 'referral_reason',
                  label: { fr: 'Raison de consultation', en: 'Reason for Consultation' },
                  type: 'narrative',
                  required: true,
                  config: {
                    placeholder: {
                      fr: 'Décrivez la raison de la consultation',
                      en: 'Describe the reason for consultation',
                    },
                  },
                },
              ],
            },
          ],
        },
        {
          key: 'chief_complaint',
          label: { fr: 'Plainte principale', en: 'Chief Complaint' },
          rows: [
            {
              columns: [
                {
                  key: 'onset_date',
                  label: { fr: "Date d'apparition", en: 'Onset Date' },
                  type: 'date',
                  required: true,
                  config: {},
                },
                {
                  key: 'mechanism_of_injury',
                  label: { fr: 'Mécanisme de blessure', en: 'Mechanism of Injury' },
                  type: 'select',
                  required: true,
                  config: {
                    options: [
                      { key: 'traumatic', fr: 'Traumatique', en: 'Traumatic' },
                      { key: 'insidious', fr: 'Insidieux', en: 'Insidious' },
                      { key: 'post_surgical', fr: 'Post-chirurgical', en: 'Post-surgical' },
                      { key: 'other', fr: 'Autre', en: 'Other' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'pain_location',
                  label: { fr: 'Localisation de la douleur', en: 'Pain Location' },
                  type: 'bodyDiagram',
                  required: true,
                  config: { view: 'front' },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'pain_intensity',
                  label: { fr: 'Intensité de la douleur (EVA)', en: 'Pain Intensity (VAS)' },
                  type: 'scale',
                  required: true,
                  config: { min: 0, max: 10, step: 1, unit: '/10' },
                },
                {
                  key: 'pain_type',
                  label: { fr: 'Type de douleur', en: 'Pain Type' },
                  type: 'checkboxGroup',
                  required: false,
                  config: {
                    options: [
                      { key: 'sharp', fr: 'Aiguë', en: 'Sharp' },
                      { key: 'dull', fr: 'Sourde', en: 'Dull' },
                      { key: 'burning', fr: 'Brûlure', en: 'Burning' },
                      { key: 'numbness', fr: 'Engourdissement', en: 'Numbness' },
                      { key: 'throbbing', fr: 'Lancinante', en: 'Throbbing' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'aggravating_factors',
                  label: { fr: 'Facteurs aggravants', en: 'Aggravating Factors' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
                {
                  key: 'relieving_factors',
                  label: { fr: 'Facteurs atténuants', en: 'Relieving Factors' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
          ],
        },
        {
          key: 'medical_history',
          label: { fr: 'Antécédents médicaux', en: 'Medical History' },
          rows: [
            {
              columns: [
                {
                  key: 'past_conditions',
                  label: { fr: 'Conditions passées', en: 'Past Conditions' },
                  type: 'checkboxWithText',
                  required: false,
                  config: {
                    items: [
                      { key: 'diabetes', label: { fr: 'Diabète', en: 'Diabetes' } },
                      { key: 'hypertension', label: { fr: 'Hypertension', en: 'Hypertension' } },
                      { key: 'cardiac', label: { fr: 'Maladie cardiaque', en: 'Cardiac Disease' } },
                      {
                        key: 'respiratory',
                        label: { fr: 'Maladie respiratoire', en: 'Respiratory Disease' },
                      },
                      { key: 'cancer', label: { fr: 'Cancer', en: 'Cancer' } },
                      { key: 'arthritis', label: { fr: 'Arthrite', en: 'Arthritis' } },
                    ],
                    columns: 2,
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'medications',
                  label: { fr: 'Médicaments actuels', en: 'Current Medications' },
                  type: 'narrative',
                  required: false,
                  config: { placeholder: { fr: 'Liste des médicaments', en: 'List medications' } },
                },
                {
                  key: 'surgeries',
                  label: { fr: 'Chirurgies antérieures', en: 'Previous Surgeries' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Page 2: Objective Examination ──
    {
      key: 'objective',
      label: { fr: 'Examen objectif', en: 'Objective Examination' },
      sections: [
        {
          key: 'observation',
          label: { fr: 'Observation', en: 'Observation' },
          rows: [
            {
              columns: [
                {
                  key: 'posture',
                  label: { fr: 'Posture', en: 'Posture' },
                  type: 'select',
                  required: true,
                  config: {
                    options: [
                      { key: 'normal', fr: 'Normale', en: 'Normal' },
                      {
                        key: 'increased_kyphosis',
                        fr: 'Cyphose augmentée',
                        en: 'Increased Kyphosis',
                      },
                      {
                        key: 'increased_lordosis',
                        fr: 'Lordose augmentée',
                        en: 'Increased Lordosis',
                      },
                      { key: 'scoliosis', fr: 'Scoliose', en: 'Scoliosis' },
                      { key: 'forward_head', fr: 'Tête antérieure', en: 'Forward Head' },
                    ],
                  },
                },
                {
                  key: 'gait',
                  label: { fr: 'Démarche', en: 'Gait' },
                  type: 'select',
                  required: true,
                  config: {
                    options: [
                      { key: 'normal', fr: 'Normale', en: 'Normal' },
                      { key: 'antalgic', fr: 'Antalgique', en: 'Antalgic' },
                      {
                        key: 'with_assistive_device',
                        fr: 'Avec aide technique',
                        en: 'With Assistive Device',
                      },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'observation_notes',
                  label: { fr: "Notes d'observation", en: 'Observation Notes' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
          ],
        },
        {
          key: 'rom',
          label: { fr: 'Amplitude articulaire', en: 'Range of Motion' },
          rows: [
            {
              columns: [
                {
                  key: 'cervical_rom',
                  label: { fr: 'Rachis cervical', en: 'Cervical Spine' },
                  type: 'romDiagram',
                  required: false,
                  config: { region: 'cervical' },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'thoracic_rom',
                  label: { fr: 'Rachis thoracique', en: 'Thoracic Spine' },
                  type: 'romDiagram',
                  required: false,
                  config: { region: 'thoracic' },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'lumbar_rom',
                  label: { fr: 'Rachis lombaire', en: 'Lumbar Spine' },
                  type: 'romDiagram',
                  required: false,
                  config: { region: 'lumbar' },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'rom_table',
                  label: { fr: 'Amplitudes articulaires', en: 'Joint Range of Motion' },
                  type: 'repeaterTable',
                  required: false,
                  config: {
                    columns: [
                      {
                        key: 'joint',
                        label: { fr: 'Articulation', en: 'Joint' },
                        type: 'text',
                      },
                      {
                        key: 'movement',
                        label: { fr: 'Mouvement', en: 'Movement' },
                        type: 'select',
                        options: ['Flexion', 'Extension', 'Abduction', 'Adduction', 'Rotation'],
                      },
                      {
                        key: 'active',
                        label: { fr: 'Actif (°)', en: 'Active (°)' },
                        type: 'text',
                      },
                      {
                        key: 'passive',
                        label: { fr: 'Passif (°)', en: 'Passive (°)' },
                        type: 'text',
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          key: 'strength',
          label: { fr: 'Force musculaire', en: 'Muscle Strength' },
          rows: [
            {
              columns: [
                {
                  key: 'strength_table',
                  label: { fr: 'Bilan musculaire', en: 'Muscle Testing' },
                  type: 'table',
                  required: false,
                  config: {
                    columns: ['Muscle / Group', 'Left', 'Right'],
                    rows: [
                      'Deltoid',
                      'Biceps',
                      'Triceps',
                      'Grip',
                      'Quadriceps',
                      'Hamstrings',
                      'Gastrocnemius',
                    ],
                  },
                },
              ],
            },
          ],
        },
        {
          key: 'palpation',
          label: { fr: 'Palpation', en: 'Palpation' },
          rows: [
            {
              columns: [
                {
                  key: 'palpation_findings',
                  label: { fr: 'Trouvailles à la palpation', en: 'Palpation Findings' },
                  type: 'narrative',
                  required: false,
                  config: {
                    placeholder: {
                      fr: 'Spasmes, points gâchettes, sensibilité',
                      en: 'Spasms, trigger points, tenderness',
                    },
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'palpation_diagram',
                  label: { fr: 'Diagramme de palpation', en: 'Palpation Diagram' },
                  type: 'bodyDiagram',
                  required: false,
                  config: { view: 'back' },
                },
              ],
            },
          ],
        },
        {
          key: 'special_tests',
          label: { fr: 'Tests spéciaux', en: 'Special Tests' },
          rows: [
            {
              columns: [
                {
                  key: 'neuro_tests',
                  label: { fr: 'Tests neurologiques', en: 'Neurological Tests' },
                  type: 'checkboxWithText',
                  required: false,
                  config: {
                    items: [
                      { key: 'slr', label: { fr: 'SLR (Lasègue)', en: 'SLR (Lasègue)' } },
                      { key: 'slump', label: { fr: 'Slump test', en: 'Slump Test' } },
                      {
                        key: 'spurling',
                        label: { fr: 'Test de Spurling', en: "Spurling's Test" },
                      },
                      {
                        key: 'upper_limb_tension',
                        label: {
                          fr: 'Tension membre supérieur',
                          en: 'Upper Limb Tension Test',
                        },
                      },
                    ],
                    columns: 2,
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'ortho_tests',
                  label: { fr: 'Tests orthopédiques', en: 'Orthopedic Tests' },
                  type: 'checkboxWithText',
                  required: false,
                  config: {
                    items: [
                      { key: 'mcmurray', label: { fr: "McMurray's", en: "McMurray's" } },
                      { key: 'lachman', label: { fr: "Lachman's", en: "Lachman's" } },
                      { key: 'drawer', label: { fr: 'Tiroir antérieur', en: 'Anterior Drawer' } },
                      { key: 'neer', label: { fr: 'Neer', en: 'Neer' } },
                      { key: 'hawkins', label: { fr: 'Hawkins-Kennedy', en: 'Hawkins-Kennedy' } },
                    ],
                    columns: 2,
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'special_tests_notes',
                  label: { fr: 'Notes sur les tests', en: 'Tests Notes' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Page 3: Assessment ──
    {
      key: 'assessment',
      label: { fr: 'Évaluation', en: 'Assessment' },
      sections: [
        {
          key: 'functional_assessment',
          label: { fr: 'Évaluation fonctionnelle', en: 'Functional Assessment' },
          rows: [
            {
              columns: [
                {
                  key: 'functional_limitations',
                  label: { fr: 'Limitations fonctionnelles', en: 'Functional Limitations' },
                  type: 'checkboxGroup',
                  required: true,
                  config: {
                    options: [
                      { key: 'walking', fr: 'Marche', en: 'Walking' },
                      { key: 'stairs', fr: 'Escaliers', en: 'Stairs' },
                      { key: 'sit_to_stand', fr: 'Se lever / asseoir', en: 'Sit to Stand' },
                      { key: 'overhead_reach', fr: 'Lever les bras', en: 'Overhead Reach' },
                      { key: 'bending', fr: 'Se pencher', en: 'Bending' },
                      { key: 'sleeping', fr: 'Dormir', en: 'Sleeping' },
                      { key: 'driving', fr: 'Conduire', en: 'Driving' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'work_status',
                  label: { fr: 'Statut de travail', en: 'Work Status' },
                  type: 'radio',
                  required: true,
                  config: {
                    options: [
                      { key: 'regular_work', fr: 'Travail régulier', en: 'Regular Work' },
                      { key: 'modified_work', fr: 'Travail modifié', en: 'Modified Work' },
                      { key: 'off_work', fr: 'Arrêt de travail', en: 'Off Work' },
                      { key: 'na', fr: 'Non applicable', en: 'N/A' },
                    ],
                  },
                },
                {
                  key: 'adl_impact',
                  label: { fr: 'Impact sur les AVQ', en: 'Impact on ADLs' },
                  type: 'scale',
                  required: true,
                  config: { min: 0, max: 10, step: 1, unit: '/10' },
                },
              ],
            },
          ],
        },
        {
          key: 'clinical_impression',
          label: { fr: 'Impression clinique', en: 'Clinical Impression' },
          rows: [
            {
              columns: [
                {
                  key: 'diagnosis',
                  label: { fr: 'Diagnostic physiothérapique', en: 'Physiotherapy Diagnosis' },
                  type: 'narrative',
                  required: true,
                  config: {
                    placeholder: {
                      fr: 'Impression clinique et diagnostic',
                      en: 'Clinical impression and diagnosis',
                    },
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'prognosis',
                  label: { fr: 'Pronostic', en: 'Prognosis' },
                  type: 'select',
                  required: true,
                  config: {
                    options: [
                      { key: 'excellent', fr: 'Excellent', en: 'Excellent' },
                      { key: 'good', fr: 'Bon', en: 'Good' },
                      { key: 'fair', fr: 'Modéré', en: 'Fair' },
                      { key: 'guarded', fr: 'Réservé', en: 'Guarded' },
                      { key: 'poor', fr: 'Pauvre', en: 'Poor' },
                    ],
                  },
                },
                {
                  key: 'expected_recovery',
                  label: { fr: 'Durée estimée de récupération', en: 'Expected Recovery Time' },
                  type: 'text',
                  required: false,
                  config: { placeholder: { fr: 'Ex: 6-8 semaines', en: 'E.g., 6-8 weeks' } },
                },
              ],
            },
          ],
        },
      ],
    },

    // ── Page 4: Treatment Plan & Goals ──
    {
      key: 'plan',
      label: { fr: 'Plan de traitement', en: 'Treatment Plan' },
      sections: [
        {
          key: 'goals',
          label: { fr: 'Objectifs', en: 'Goals' },
          rows: [
            {
              columns: [
                {
                  key: 'short_term_goals',
                  label: {
                    fr: 'Objectifs à court terme (2-4 sem.)',
                    en: 'Short-term Goals (2-4 wk)',
                  },
                  type: 'narrative',
                  required: true,
                  config: {},
                },
                {
                  key: 'long_term_goals',
                  label: {
                    fr: 'Objectifs à long terme (8-12 sem.)',
                    en: 'Long-term Goals (8-12 wk)',
                  },
                  type: 'narrative',
                  required: true,
                  config: {},
                },
              ],
            },
          ],
        },
        {
          key: 'treatment',
          label: { fr: 'Interventions planifiées', en: 'Planned Interventions' },
          rows: [
            {
              columns: [
                {
                  key: 'modalities',
                  label: { fr: 'Modalités', en: 'Modalities' },
                  type: 'checkboxGroup',
                  required: false,
                  config: {
                    options: [
                      { key: 'manual_therapy', fr: 'Thérapie manuelle', en: 'Manual Therapy' },
                      {
                        key: 'therapeutic_exercises',
                        fr: 'Exercices thérapeutiques',
                        en: 'Therapeutic Exercises',
                      },
                      { key: 'electrotherapy', fr: 'Électrothérapie', en: 'Electrotherapy' },
                      { key: 'ultrasound', fr: 'Ultrasons', en: 'Ultrasound' },
                      { key: 'ice_heat', fr: 'Glace / Chaleur', en: 'Ice / Heat' },
                      { key: 'taping', fr: 'Taping', en: 'Taping' },
                      { key: 'dry_needling', fr: 'Aiguilles sèches', en: 'Dry Needling' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'frequency',
                  label: { fr: 'Fréquence recommandée', en: 'Recommended Frequency' },
                  type: 'select',
                  required: true,
                  config: {
                    options: [
                      { key: '1x_week', fr: '1x / semaine', en: '1x / week' },
                      { key: '2x_week', fr: '2x / semaine', en: '2x / week' },
                      { key: '3x_week', fr: '3x / semaine', en: '3x / week' },
                      { key: 'every_2_weeks', fr: 'Aux 2 semaines', en: 'Every 2 weeks' },
                    ],
                  },
                },
                {
                  key: 'total_visits',
                  label: { fr: 'Nombre de visites estimé', en: 'Estimated Total Visits' },
                  type: 'text',
                  required: false,
                  config: { placeholder: { fr: 'Ex: 8-12', en: 'E.g., 8-12' } },
                },
              ],
            },
          ],
        },
        {
          key: 'precautions',
          label: { fr: 'Précautions et contre-indications', en: 'Precautions & Contraindications' },
          rows: [
            {
              columns: [
                {
                  key: 'red_flags',
                  label: { fr: 'Drapeaux rouges', en: 'Red Flags' },
                  type: 'legend',
                  required: false,
                  config: {
                    content: {
                      fr: 'Vérifier: perte de poids inexpliquée, douleur nocturne constante, déficit neurologique progressif, traumatisme majeur',
                      en: 'Check for: unexplained weight loss, constant night pain, progressive neurological deficit, major trauma',
                    },
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'precautions_notes',
                  label: { fr: 'Notes sur les précautions', en: 'Precaution Notes' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
          ],
        },
        {
          key: 'consent',
          label: { fr: 'Consentement', en: 'Consent' },
          rows: [
            {
              columns: [
                {
                  key: 'patient_consent',
                  label: {
                    fr: 'Consentement éclairé obtenu',
                    en: 'Informed Consent Obtained',
                  },
                  type: 'radio',
                  required: true,
                  config: {
                    options: [
                      { key: 'yes', fr: 'Oui', en: 'Yes' },
                      { key: 'no', fr: 'Non', en: 'No' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'therapist_signature',
                  label: { fr: 'Signature du thérapeute', en: 'Therapist Signature' },
                  type: 'signature',
                  required: true,
                  config: {},
                },
              ],
            },
          ],
        },
      ],
    },
  ],
}
