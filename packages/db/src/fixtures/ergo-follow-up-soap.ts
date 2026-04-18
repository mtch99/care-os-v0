import type { TemplateContentV2 } from '@careos/api-contract'

/**
 * Ergotherapy follow-up SOAP note template (v0.2)
 * 1 page, 4 sections (Subjective, Objective, Assessment, Plan), bilingual fr/en
 */
export const ergoFollowUpSoap: TemplateContentV2 = {
  schemaVersion: '0.3',
  locale: ['fr', 'en'],
  pages: [
    {
      key: 'soap',
      label: { fr: 'Note SOAP — Suivi', en: 'SOAP Note — Follow-up' },
      sections: [
        // ── Subjective ──
        {
          key: 'subjective',
          label: { fr: 'Subjectif', en: 'Subjective' },
          rows: [
            {
              columns: [
                {
                  key: 'functional_change',
                  label: {
                    fr: 'Évolution fonctionnelle depuis la dernière visite',
                    en: 'Functional Change Since Last Visit',
                  },
                  type: 'radio',
                  required: true,
                  config: {
                    options: [
                      { key: 'improved', fr: 'Amélioré', en: 'Improved' },
                      { key: 'stable', fr: 'Stable', en: 'Stable' },
                      { key: 'worsened', fr: 'Aggravé', en: 'Worsened' },
                    ],
                  },
                },
                {
                  key: 'pain_level',
                  label: { fr: 'Douleur actuelle (EVA)', en: 'Current Pain (VAS)' },
                  type: 'scale',
                  required: false,
                  config: { min: 0, max: 10, step: 1, unit: '/10' },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'patient_report',
                  label: { fr: 'Rapport du patient', en: 'Patient Report' },
                  type: 'narrative',
                  required: true,
                  config: {
                    placeholder: {
                      fr: 'Difficultés dans les AVQ, compliance aux recommandations, événements depuis la dernière visite',
                      en: 'ADL difficulties, compliance with recommendations, events since last visit',
                    },
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'home_program_compliance',
                  label: {
                    fr: 'Observance du programme à domicile',
                    en: 'Home Program Compliance',
                  },
                  type: 'select',
                  required: false,
                  config: {
                    options: [
                      { key: 'full', fr: 'Complète', en: 'Full' },
                      { key: 'partial', fr: 'Partielle', en: 'Partial' },
                      { key: 'none', fr: 'Aucune', en: 'None' },
                    ],
                  },
                },
                {
                  key: 'assistive_device_usage',
                  label: {
                    fr: 'Utilisation des aides techniques',
                    en: 'Assistive Device Usage',
                  },
                  type: 'select',
                  required: false,
                  config: {
                    options: [
                      { key: 'regular', fr: 'Régulière', en: 'Regular' },
                      { key: 'occasional', fr: 'Occasionnelle', en: 'Occasional' },
                      { key: 'none', fr: 'Aucune', en: 'None' },
                      { key: 'na', fr: 'Non applicable', en: 'N/A' },
                    ],
                  },
                },
              ],
            },
          ],
        },

        // ── Objective ──
        {
          key: 'objective',
          label: { fr: 'Objectif', en: 'Objective' },
          rows: [
            {
              columns: [
                {
                  key: 'adl_observations',
                  label: { fr: 'Observations AVQ', en: 'ADL Observations' },
                  type: 'narrative',
                  required: false,
                  config: {
                    placeholder: {
                      fr: 'Performance observée dans les activités ciblées',
                      en: 'Observed performance in targeted activities',
                    },
                  },
                },
                {
                  key: 'upper_extremity_findings',
                  label: { fr: 'Membre supérieur', en: 'Upper Extremity Findings' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
            {
              columns: [
                {
                  key: 'cognitive_observations',
                  label: { fr: 'Observations cognitives', en: 'Cognitive Observations' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
                {
                  key: 'environmental_factors',
                  label: { fr: 'Facteurs environnementaux', en: 'Environmental Factors' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
          ],
        },

        // ── Assessment ──
        {
          key: 'assessment',
          label: { fr: 'Évaluation', en: 'Assessment' },
          rows: [
            {
              columns: [
                {
                  key: 'progress',
                  label: { fr: 'Progrès', en: 'Progress' },
                  type: 'radio',
                  required: true,
                  config: {
                    options: [
                      { key: 'meeting_goals', fr: 'Atteint les objectifs', en: 'Meeting Goals' },
                      { key: 'partial_progress', fr: 'Progrès partiels', en: 'Partial Progress' },
                      { key: 'plateau', fr: 'Plateau', en: 'Plateau' },
                      { key: 'regression', fr: 'Régression', en: 'Regression' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'clinical_reasoning',
                  label: { fr: 'Raisonnement clinique', en: 'Clinical Reasoning' },
                  type: 'narrative',
                  required: true,
                  config: {
                    placeholder: {
                      fr: 'Analyse des résultats et raisonnement clinique',
                      en: 'Analysis of findings and clinical reasoning',
                    },
                  },
                },
              ],
            },
          ],
        },

        // ── Plan ──
        {
          key: 'plan',
          label: { fr: 'Plan', en: 'Plan' },
          rows: [
            {
              columns: [
                {
                  key: 'treatment_provided',
                  label: { fr: 'Interventions effectuées', en: 'Interventions Provided' },
                  type: 'checkboxGroup',
                  required: true,
                  config: {
                    options: [
                      { key: 'adl_training', fr: 'Entraînement aux AVQ', en: 'ADL Training' },
                      {
                        key: 'therapeutic_exercises',
                        fr: 'Exercices thérapeutiques',
                        en: 'Therapeutic Exercises',
                      },
                      { key: 'assistive_devices', fr: 'Aides techniques', en: 'Assistive Devices' },
                      {
                        key: 'home_modifications',
                        fr: 'Adaptation domiciliaire',
                        en: 'Home Modifications',
                      },
                      { key: 'splinting_orthotics', fr: 'Orthèse', en: 'Splinting / Orthotics' },
                      {
                        key: 'cognitive_stimulation',
                        fr: 'Stimulation cognitive',
                        en: 'Cognitive Stimulation',
                      },
                      { key: 'education', fr: 'Éducation', en: 'Education' },
                    ],
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'treatment_notes',
                  label: { fr: 'Notes de traitement', en: 'Treatment Notes' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
            {
              columns: [
                {
                  key: 'home_program_update',
                  label: {
                    fr: 'Mise à jour du programme à domicile',
                    en: 'Home Program Update',
                  },
                  type: 'narrative',
                  required: false,
                  config: {
                    placeholder: {
                      fr: 'Nouvelles recommandations, modifications',
                      en: 'New recommendations, modifications',
                    },
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'next_visit_plan',
                  label: { fr: 'Plan pour la prochaine visite', en: 'Next Visit Plan' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
                {
                  key: 'referral_needed',
                  label: { fr: 'Référence nécessaire', en: 'Referral Needed' },
                  type: 'radio',
                  required: false,
                  config: {
                    options: [
                      { key: 'no', fr: 'Non', en: 'No' },
                      { key: 'physician', fr: 'Médecin', en: 'Physician' },
                      { key: 'specialist', fr: 'Spécialiste', en: 'Specialist' },
                      { key: 'social_worker', fr: 'Travailleur social', en: 'Social Worker' },
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
