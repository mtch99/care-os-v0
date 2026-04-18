import type { TemplateContentV2 } from '@careos/api-contract'

/**
 * Physio follow-up SOAP note template (v0.2)
 * 1 page, 4 sections (Subjective, Objective, Assessment, Plan), bilingual fr/en
 */
export const physioFollowUpSoap: TemplateContentV2 = {
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
                  key: 'current_pain',
                  label: { fr: 'Douleur actuelle (EVA)', en: 'Current Pain (VAS)' },
                  type: 'scale',
                  required: true,
                  config: { min: 0, max: 10, step: 1, unit: '/10' },
                },
                {
                  key: 'pain_change',
                  label: {
                    fr: 'Évolution depuis la dernière visite',
                    en: 'Change Since Last Visit',
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
                      fr: 'Symptômes, compliance aux exercices, événements depuis la dernière visite',
                      en: 'Symptoms, exercise compliance, events since last visit',
                    },
                  },
                },
              ],
            },
            {
              columns: [
                {
                  key: 'exercise_compliance',
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
                  key: 'sleep_quality',
                  label: { fr: 'Qualité du sommeil', en: 'Sleep Quality' },
                  type: 'scale',
                  required: false,
                  config: { min: 0, max: 10, step: 1, unit: '/10' },
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
                  key: 'rom_findings',
                  label: { fr: 'Amplitudes articulaires', en: 'Range of Motion Findings' },
                  type: 'narrative',
                  required: false,
                  config: {
                    placeholder: {
                      fr: 'Changements depuis la dernière évaluation',
                      en: 'Changes since last assessment',
                    },
                  },
                },
                {
                  key: 'strength_findings',
                  label: { fr: 'Force musculaire', en: 'Strength Findings' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
              ],
            },
            {
              columns: [
                {
                  key: 'palpation_findings',
                  label: { fr: 'Palpation', en: 'Palpation' },
                  type: 'narrative',
                  required: false,
                  config: {},
                },
                {
                  key: 'functional_tests',
                  label: { fr: 'Tests fonctionnels', en: 'Functional Tests' },
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
                  label: { fr: 'Traitement effectué', en: 'Treatment Provided' },
                  type: 'checkboxGroup',
                  required: true,
                  config: {
                    options: [
                      { key: 'manual_therapy', fr: 'Thérapie manuelle', en: 'Manual Therapy' },
                      { key: 'therapeutic_exercises', fr: 'Exercices thérapeutiques', en: 'Therapeutic Exercises' },
                      { key: 'electrotherapy', fr: 'Électrothérapie', en: 'Electrotherapy' },
                      { key: 'ultrasound', fr: 'Ultrasons', en: 'Ultrasound' },
                      { key: 'ice_heat', fr: 'Glace / Chaleur', en: 'Ice / Heat' },
                      { key: 'taping', fr: 'Taping', en: 'Taping' },
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
                      fr: 'Nouveaux exercices, modifications',
                      en: 'New exercises, modifications',
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
                      { key: 'imaging', fr: 'Imagerie', en: 'Imaging' },
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
