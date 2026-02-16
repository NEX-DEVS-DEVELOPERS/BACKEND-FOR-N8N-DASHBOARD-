-- ==============================================
-- FORM SUBMISSIONS TABLES
-- ==============================================

-- 1. SUPPORT REQUESTS
CREATE TABLE IF NOT EXISTS support_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    issue TEXT NOT NULL,
    specialist_id VARCHAR(50),
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed
    created_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP DEFAULT NOW(), -- synonym for created_at
    resolved_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_support_requests_user_id ON support_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_support_requests_status ON support_requests(status);
CREATE INDEX IF NOT EXISTS idx_support_requests_submitted_at ON support_requests(submitted_at DESC);


-- 2. REQUEST CHANGES (FEATURE REQUESTS)
CREATE TABLE IF NOT EXISTS request_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high
    status VARCHAR(50) DEFAULT 'pending', -- pending, in_progress, completed, rejected
    created_at TIMESTAMP DEFAULT NOW(),
    submitted_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_request_changes_user_id ON request_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_request_changes_status ON request_changes(status);


-- 3. CONTACT SUBMISSIONS (PUBLIC FORM)
CREATE TABLE IF NOT EXISTS contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'new', -- new, read, replied
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at DESC);
