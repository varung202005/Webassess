-- Associates one or more existing Proctor users with an exam.
CREATE TABLE IF NOT EXISTS exam_proctors (
    exam_id UUID NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
    proctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (exam_id, proctor_id)
);

CREATE INDEX IF NOT EXISTS idx_exam_proctors_proctor_id
    ON exam_proctors(proctor_id);
