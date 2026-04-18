import type { TemplateContentV2 } from '@careos/api-contract'

/**
 * Ergotherapy initial evaluation template (v0.2)
 * 3 pages, bilingual fr/en
 */
export const ergoInitialEval: TemplateContentV2 = {
  schemaVersion: '0.3',
  locale: ['fr', 'en'],
  pages: [
    // ── Page 1: Patient Profile & Occupational History ──
    {
      key: 'profile',
      label: { fr: 'Profil du patient', en: 'Patient Profile' },
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
          key: 'occupational_profile',
          label: { fr: 'Profil occupationnel', en: 'Occupational Profile' },
          rows: [
            {
              columns: [
                {
                  key: 'dominant_hand',
                  label: { fr: 'Main dominante', en: 'Dominant Hand' },
                  type: 'radio',
                  required: true,
                  config: {
                    options: [
                      { key: 'right', fr: 'Droite', en: 'Right' },
                      { key: 'left', fr: 'Gauche', en: 'Left' },
                      { key: 'ambidextrous', fr: 'Ambidextre', en: 'Ambidextrous' },
                    ],
                  },
                },
                {
                  key: 'living_situation',
                  label: { fr: 'Milieu de vie', en: 'Living Situation' },
                  type: 'select',
                  required: true,
                  config: {
                    options: [
                      { key: 'home_alone', fr: 'Domicile — seul', en: 'Home — alone' },
                      { key: 'home_with_family', fr: 'Domicile — avec famille', en: 'Home — with family' },
                      { key: 'assisted_living', fr: 'Résidence', en: 'Assisted living' },
                      { key: 'long_term_care', fr: 'CHSLD', en: 'Long-term care' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'occupation',
                  label: { fr: 'Occupation / emploi', en: 'Occupation / Employment' },
                  type: 'text',
                  required: false,
                  config: {},
                },
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
                      { key: 'retired', fr: 'Retraité', en: 'Retired' },
                      { key: 'na', fr: 'Non applicable', en: 'N/A' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'leisure_activities',
                  label: {
                    fr: 'Loisirs et activités significatives',
                    en: 'Leisure & Meaningful Activities',
                  },
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
                        key: 'neurological',
                        label: { fr: 'Condition neurologique', en: 'Neurological Condition' },
                      },
                      { key: 'mental_health', label: { fr: 'Santé mentale', en: 'Mental Health' } },
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

    // ── Page 2: Functional Assessment ──
    {
      key: 'functional',
      label: { fr: 'Évaluation fonctionnelle', en: 'Functional Assessment' },
      sections: [
        {
          key: 'adl',
          label: {
            fr: 'Activités de la vie quotidienne (AVQ)',
            en: 'Activities of Daily Living (ADL)',
          },
          rows: [
            {
              columns: [
                {
                  key: 'adl_assessment',
                  label: { fr: 'Autonomie dans les AVQ', en: 'ADL Independence' },
                  type: 'checkboxWithText',
                  required: true,
                  config: {
                    items: [
                      { key: 'feeding', label: { fr: 'Alimentation', en: 'Feeding' } },
                      { key: 'dressing', label: { fr: 'Habillage', en: 'Dressing' } },
                      { key: 'bathing', label: { fr: 'Hygiène / bain', en: 'Bathing / Hygiene' } },
                      { key: 'toileting', label: { fr: 'Toilette', en: 'Toileting' } },
                      { key: 'transfers', label: { fr: 'Transferts', en: 'Transfers' } },
                      { key: 'mobility', label: { fr: 'Mobilité', en: 'Mobility' } },
                    ],
                    columns: 2,
                  },
                },
              ],
            },
          ],
        },
        {
          key: 'iadl',
          label: { fr: 'Activités instrumentales (AIVQ)', en: 'Instrumental ADLs (IADL)' },
          rows: [
            {
              columns: [
                {
                  key: 'iadl_assessment',
                  label: { fr: 'Autonomie dans les AIVQ', en: 'IADL Independence' },
                  type: 'checkboxWithText',
                  required: false,
                  config: {
                    items: [
                      {
                        key: 'meal_prep',
                        label: { fr: 'Préparation des repas', en: 'Meal Preparation' },
                      },
                      {
                        key: 'housekeeping',
                        label: { fr: 'Entretien ménager', en: 'Housekeeping' },
                      },
                      { key: 'laundry', label: { fr: 'Lessive', en: 'Laundry' } },
                      { key: 'shopping', label: { fr: 'Courses', en: 'Shopping' } },
                      {
                        key: 'finances',
                        label: { fr: 'Gestion financière', en: 'Financial Management' },
                      },
                      { key: 'driving', label: { fr: 'Conduite automobile', en: 'Driving' } },
                    ],
                    columns: 2,
                  },
                },
              ],
            },
          ],
        },
        {
          key: 'upper_extremity',
          label: { fr: 'Évaluation du membre supérieur', en: 'Upper Extremity Assessment' },
          rows: [
            {
              columns: [
                {
                  key: 'grip_strength',
                  label: { fr: 'Force de préhension (kg)', en: 'Grip Strength (kg)' },
                  type: 'narrative',
                  required: false,
                  config: {
                    placeholder: {
                      fr: 'Gauche / Droite — dynamomètre Jamar',
                      en: 'Left / Right — Jamar dynamometer',
                    },
                  },
                },
                {
                  key: 'pinch_strength',
                  label: { fr: 'Force de pince (kg)', en: 'Pinch Strength (kg)' },
                  type: 'narrative',
                  required: false,
                  config: {
                    placeholder: {
                      fr: 'Pince latérale, tripode, terminale',
                      en: 'Lateral, tripod, tip pinch',
                    },
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'sensation',
                  label: { fr: 'Sensibilité', en: 'Sensation' },
                  type: 'narrative',
                  required: false,
                  config: {
                    placeholder: {
                      fr: 'Monofilaments, discrimination deux points',
                      en: 'Monofilaments, two-point discrimination',
                    },
                  },
                },
                {
                  key: 'fine_motor',
                  label: { fr: 'Motricité fine', en: 'Fine Motor Skills' },
                  type: 'narrative',
                  required: false,
                  config: {
                    placeholder: {
                      fr: "Nine-Hole Peg Test, manipulation d'objets",
                      en: 'Nine-Hole Peg Test, object manipulation',
                    },
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'rom_notes',
                  label: { fr: 'Amplitudes articulaires (notes)', en: 'Range of Motion (notes)' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
          ],
        },
        {
          key: 'cognitive_screen',
          label: { fr: 'Dépistage cognitif', en: 'Cognitive Screening' },
          rows: [
            {
              columns: [
                {
                  key: 'orientation',
                  label: { fr: 'Orientation', en: 'Orientation' },
                  type: 'checkboxGroup',
                  required: false,
                  config: {
                    options: [
                      { key: 'time', fr: 'Temps', en: 'Time' },
                      { key: 'place', fr: 'Lieu', en: 'Place' },
                      { key: 'person', fr: 'Personne', en: 'Person' },
                    ],
                  },
                },
                {
                  key: 'attention',
                  label: { fr: 'Attention / concentration', en: 'Attention / Concentration' },
                  type: 'select',
                  required: false,
                  config: {
                    options: [
                      { key: 'intact', fr: 'Intacte', en: 'Intact' },
                      { key: 'mildly_impaired', fr: 'Légèrement altérée', en: 'Mildly Impaired' },
                      { key: 'moderately_impaired', fr: 'Modérément altérée', en: 'Moderately Impaired' },
                      { key: 'severely_impaired', fr: 'Sévèrement altérée', en: 'Severely Impaired' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'cognitive_notes',
                  label: { fr: 'Notes cognitives', en: 'Cognitive Notes' },
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

    // ── Page 3: Assessment & Treatment Plan ──
    {
      key: 'plan',
      label: { fr: 'Évaluation et plan', en: 'Assessment & Plan' },
      sections: [
        {
          key: 'clinical_impression',
          label: { fr: 'Impression clinique', en: 'Clinical Impression' },
          rows: [
            {
              columns: [
                {
                  key: 'diagnosis',
                  label: { fr: 'Diagnostic ergothérapique', en: 'Occupational Therapy Diagnosis' },
                  type: 'narrative',
                  required: true,
                  config: {
                    placeholder: {
                      fr: 'Résumé des déficits occupationnels identifiés',
                      en: 'Summary of identified occupational deficits',
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
          key: 'interventions',
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
                      { key: 'adl_training', fr: 'Entraînement aux AVQ', en: 'ADL Training' },
                      { key: 'therapeutic_exercises', fr: 'Exercices thérapeutiques', en: 'Therapeutic Exercises' },
                      { key: 'assistive_devices', fr: 'Aides techniques', en: 'Assistive Devices' },
                      { key: 'home_modifications', fr: 'Adaptation domiciliaire', en: 'Home Modifications' },
                      { key: 'splinting_orthotics', fr: 'Orthèse', en: 'Splinting / Orthotics' },
                      { key: 'cognitive_stimulation', fr: 'Stimulation cognitive', en: 'Cognitive Stimulation' },
                      { key: 'education', fr: 'Éducation', en: 'Education' },
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
