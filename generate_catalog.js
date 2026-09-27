const fs = require('fs');
const path = require('path');

function createPdfBuffer({ title, unitCode, unitName, faculty, type, price, year, semester, pages, hasSolutions, previewQuestions }) {
    const lines = [
        `Course KENYA - STUDENT RESOURCE PORTAL`,
        `CONFIDENTIAL & VERIFIED ACADEMIC RESOURCE`,
        `============================================================`,
        `FACULTY: ${faculty.toUpperCase()}`,
        `COURSE UNIT: ${unitCode} - ${unitName}`,
        `EXAMINATION TYPE: ${type.toUpperCase()}`,
        `ACADEMIC YEAR: ${year} | ${semester.toUpperCase()}`,
        `PRICE: KES ${price}.00 (PAID & VERIFIED)`,
        `SOLUTIONS: ${hasSolutions ? 'COMPREHENSIVE MARKING SCHEME INCLUDED' : 'QUESTION PAPER ONLY'}`,
        `TOTAL PAGES: ${pages} PAGES | WATERMARK: COURSE GENUINE COPY`,
        `============================================================`,
        ``,
        `INSTRUCTIONS TO CANDIDATES:`,
        `1. Answer Question ONE in Section A (Compulsory) and any other TWO questions in Section B.`,
        `2. Write your answers legibly in the provided answer booklet.`,
        `3. Non-programmable scientific calculators are permitted.`,
        `4. Time Allowed: 2 Hours 30 Minutes.`,
        ``,
        `------------------------------------------------------------`,
        `SECTION A: COMPULSORY (30 MARKS)`,
        `------------------------------------------------------------`,
        ``
    ];

    if (previewQuestions && previewQuestions.length > 0) {
        previewQuestions.forEach((q, i) => {
            lines.push(q);
            lines.push('');
        });
    } else {
        lines.push('1. (a) Define key foundational principles and explain applications in modern practice. [6 Marks]');
        lines.push('1. (b) Compare and contrast theoretical and experimental models under realistic conditions. [8 Marks]');
        lines.push('1. (c) Analyze the critical constraints and present a comprehensive mathematical proof. [10 Marks]');
        lines.push('1. (d) Outline the regulatory framework and standard compliance procedures. [6 Marks]');
        lines.push('');
    }

    lines.push(`------------------------------------------------------------`);
    lines.push(`SECTION B: ANSWER ANY TWO QUESTIONS (20 MARKS EACH)`);
    lines.push(`------------------------------------------------------------`);
    lines.push(`2. (a) Formulate the optimization function and solve for boundary constraints. [10 Marks]`);
    lines.push(`2. (b) Provide step-by-step analytical derivation with full annotations. [10 Marks]`);
    lines.push(`3. (a) Evaluate real-world case studies demonstrating strategic failure and remediation. [12 Marks]`);
    lines.push(`3. (b) Propose architectural best practices for scalable deployment. [8 Marks]`);
    lines.push(``);
    if (hasSolutions) {
        lines.push(`============================================================`);
        lines.push(`DETAILED MARKING SCHEME & MODEL SOLUTIONS:`);
        lines.push(`- Question 1 Model Solution with scoring rubrics and step breakdown.`);
        lines.push(`- Complete worked steps verified by university external examiners.`);
        lines.push(`============================================================`);
    }
    lines.push(``);
    lines.push(`Powered by Course Kenya - Instant M-Pesa Exam Delivery`);
    lines.push(`Contact Support: +254 700 000 000 | support@course.co.ke`);

    // PDF stream text generator
    let streamText = `BT\n/F1 10 Tf\n50 780 Td\n`;
    lines.forEach((line, index) => {
        // escape parentheses
        const clean = line.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
        if (index === 0) {
            streamText += `/F2 14 Tf\n(${clean}) Tj\n0 -20 Td\n/F1 9 Tf\n`;
        } else if (line.startsWith('===') || line.startsWith('---')) {
            streamText += `/F1 8 Tf\n(${clean}) Tj\n0 -14 Td\n`;
        } else if (line.startsWith('SECTION') || line.startsWith('INSTRUCTIONS') || line.startsWith('FACULTY')) {
            streamText += `/F2 10 Tf\n(${clean}) Tj\n0 -15 Td\n/F1 9 Tf\n`;
        } else {
            streamText += `(${clean}) Tj\n0 -13 Td\n`;
        }
    });
    streamText += `ET`;

    const streamLen = Buffer.byteLength(streamText, 'utf8');

    const pdfData = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>
endobj
4 0 obj
<< /Length ${streamLen} >>
stream
${streamText}
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
6 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>
endobj
xref
0 7
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000252 00000 n 
0000000300 00000 n 
0000000370 00000 n 
trailer
<< /Size 7 /Root 1 0 R >>
startxref
450
%%EOF`;

    return Buffer.from(pdfData);
}

const materials = [
    // COMPUTING & INFORMATICS
    // Unit 1: BCS 201 Data Structures & Algorithms
    {
        id: 'bcs201-pp-2024',
        faculty: 'School of Computing & Informatics',
        facultyId: 'computing',
        unitCode: 'BCS 201',
        unitName: 'Data Structures and Algorithms',
        title: 'BCS 201: Data Structures & Algorithms - Main Examination (April 2024)',
        type: 'Past Paper',
        category: 'past-paper',
        price: 200,
        year: 2024,
        semester: 'Semester 2',
        institution: 'University Examination Board',
        pages: 6,
        fileSize: '340 KB',
        hasSolutions: true,
        description: 'Complete 2024 End of Semester Examination covering Trees, Graphs, Sorting algorithms, Big-O analysis and AVL rotations with full step-by-step marking scheme.',
        fileName: 'BCS_201_Data_Structures_2024_Main_Exam.pdf',
        filePath: 'documents/computing/BCS_201_Data_Structures_2024_Main_Exam.pdf',
        previewQuestions: [
            '1. (a) Differentiate between an Abstract Data Type (ADT) and a concrete Data Structure with examples [4 Marks]',
            '1. (b) Explain the collision resolution techniques in Open Addressing hashing: Linear Probing vs Double Hashing [6 Marks]',
            '1. (c) Given array [45, 12, 85, 32, 89, 39, 69, 44, 42, 1, 45], trace the partition step in Quicksort [8 Marks]',
            '2. (a) Construct an AVL Tree by inserting keys: 21, 26, 30, 9, 4, 14, 28, 18, 15 and specify all balance factor updates [12 Marks]'
        ]
    },
    {
        id: 'bcs201-pp-2023',
        faculty: 'School of Computing & Informatics',
        facultyId: 'computing',
        unitCode: 'BCS 201',
        unitName: 'Data Structures and Algorithms',
        title: 'BCS 201: Data Structures & Algorithms - Main Examination (Nov 2023)',
        type: 'Past Paper',
        category: 'past-paper',
        price: 200,
        year: 2023,
        semester: 'Semester 1',
        institution: 'University Examination Board',
        pages: 5,
        fileSize: '310 KB',
        hasSolutions: true,
        description: 'Complete 2023 End of Semester exam on Recursion, Linked lists, Dijkstra’s algorithm, and dynamic programming with full solution key.',
        fileName: 'BCS_201_Data_Structures_2023_Main_Exam.pdf',
        filePath: 'documents/computing/BCS_201_Data_Structures_2023_Main_Exam.pdf',
        previewQuestions: [
            '1. (a) Write a C++ or Java method to detect a cycle in a singly linked list using Floyd’s Cycle Detection [8 Marks]',
            '1. (b) Show that any comparison-based sorting algorithm requires at least Omega(n log n) comparisons in the worst case [6 Marks]'
        ]
    },
    {
        id: 'bcs201-cat-2024',
        faculty: 'School of Computing & Informatics',
        facultyId: 'computing',
        unitCode: 'BCS 201',
        unitName: 'Data Structures and Algorithms',
        title: 'BCS 201: CAT 1 (Continuous Assessment Test) - Arrays, Stacks & Queues',
        type: 'CAT',
        category: 'cat',
        price: 25,
        year: 2024,
        semester: 'Semester 2',
        institution: 'Department of Computer Science',
        pages: 3,
        fileSize: '180 KB',
        hasSolutions: true,
        description: 'Mid-term assessment test covering array representations, stack evaluation of postfix expressions, and circular queue operations with verified solutions.',
        fileName: 'BCS_201_Data_Structures_CAT1_2024.pdf',
        filePath: 'documents/computing/BCS_201_Data_Structures_CAT1_2024.pdf',
        previewQuestions: [
            '1. Evaluate the postfix expression using stack simulation: 12 4 / 5 3 * + 2 ^ [10 Marks]',
            '2. Implement enqueue and dequeue for a Circular Queue of size 8 in pseudocode [10 Marks]'
        ]
    },
    {
        id: 'bcs201-cat2-2024',
        faculty: 'School of Computing & Informatics',
        facultyId: 'computing',
        unitCode: 'BCS 201',
        unitName: 'Data Structures and Algorithms',
        title: 'BCS 201: CAT 2 - Binary Search Trees & Graph Traversals',
        type: 'CAT',
        category: 'cat',
        price: 25,
        year: 2024,
        semester: 'Semester 2',
        institution: 'Department of Computer Science',
        pages: 3,
        fileSize: '195 KB',
        hasSolutions: true,
        description: 'Second continuous assessment test focusing on BST deletion cases, BFS/DFS traversal algorithms, and Topological Sort with answers.',
        fileName: 'BCS_201_Data_Structures_CAT2_2024.pdf',
        filePath: 'documents/computing/BCS_201_Data_Structures_CAT2_2024.pdf',
        previewQuestions: [
            '1. Illustrate node deletion in a BST when the node has two children using in-order successor [10 Marks]',
            '2. Compare Breadth First Search (BFS) and Depth First Search (DFS) space complexity [10 Marks]'
        ]
    },
    {
        id: 'bcs201-special-2024',
        faculty: 'School of Computing & Informatics',
        facultyId: 'computing',
        unitCode: 'BCS 201',
        unitName: 'Data Structures and Algorithms',
        title: 'BCS 201: Special & Supplementary Examination (August 2024)',
        type: 'Special Exam',
        category: 'special',
        price: 250,
        year: 2024,
        semester: 'Special Session',
        institution: 'University Examination Board',
        pages: 7,
        fileSize: '420 KB',
        hasSolutions: true,
        description: 'Official Special / Supplementary exam paper covering entire semester syllabus with in-depth solutions and examiner criteria.',
        fileName: 'BCS_201_Data_Structures_Special_Exam_2024.pdf',
        filePath: 'documents/computing/BCS_201_Data_Structures_Special_Exam_2024.pdf',
        previewQuestions: [
            '1. (a) Discuss the amortized analysis of dynamic arrays using the accounting method [8 Marks]',
            '1. (b) Explain Red-Black tree properties and demonstrate recoloring during insertion [12 Marks]',
            '2. Solve the 0/1 Knapsack Problem using Dynamic Programming with state table [15 Marks]'
        ]
    },

    // Unit 2: BIT 301 Database Systems & SQL
    {
        id: 'bit301-pp-2024',
        faculty: 'School of Computing & Informatics',
        facultyId: 'computing',
        unitCode: 'BIT 301',
        unitName: 'Database Management Systems',
        title: 'BIT 301: Database Management Systems - Main Examination (2024)',
        type: 'Past Paper',
        category: 'past-paper',
        price: 200,
        year: 2024,
        semester: 'Semester 1',
        institution: 'Faculty of Information Technology',
        pages: 5,
        fileSize: '290 KB',
        hasSolutions: true,
        description: 'Comprehensive past paper on Relational Algebra, SQL DDL/DML, 1NF to BCNF Normalization, ACID transactions, and indexing.',
        fileName: 'BIT_301_Database_Systems_2024_Main.pdf',
        filePath: 'documents/computing/BIT_301_Database_Systems_2024_Main.pdf',
        previewQuestions: [
            '1. Given relation R(A, B, C, D, E) with FDs {A->B, BC->D, D->E}, determine candidate keys and highest normal form [10 Marks]',
            '2. Write advanced SQL queries with window functions (RANK, PARTITION BY) for an e-commerce database [10 Marks]'
        ]
    },
    {
        id: 'bit301-cat-2024',
        faculty: 'School of Computing & Informatics',
        facultyId: 'computing',
        unitCode: 'BIT 301',
        unitName: 'Database Management Systems',
        title: 'BIT 301: CAT 1 - ER Modeling & Relational Schema Design',
        type: 'CAT',
        category: 'cat',
        price: 25,
        year: 2024,
        semester: 'Semester 1',
        institution: 'Faculty of Information Technology',
        pages: 3,
        fileSize: '175 KB',
        hasSolutions: true,
        description: 'Continuous assessment test on Enhanced Entity Relationship (EER) modeling, cardinalities, and converting ER diagrams into 3NF relational schemas.',
        fileName: 'BIT_301_Database_CAT1_2024.pdf',
        filePath: 'documents/computing/BIT_301_Database_CAT1_2024.pdf',
        previewQuestions: [
            '1. Design an ER diagram for a hospital management system modeling patients, doctors, admissions, and lab tests [15 Marks]',
            '2. Convert multi-valued and composite attributes into normalized tables [10 Marks]'
        ]
    },
    {
        id: 'bit301-special-2024',
        faculty: 'School of Computing & Informatics',
        facultyId: 'computing',
        unitCode: 'BIT 301',
        unitName: 'Database Management Systems',
        title: 'BIT 301: Special / Supplementary Examination - Database Systems',
        type: 'Special Exam',
        category: 'special',
        price: 250,
        year: 2024,
        semester: 'Special Session',
        institution: 'University Examination Board',
        pages: 6,
        fileSize: '360 KB',
        hasSolutions: true,
        description: 'Special / Supplementary paper covering Concurrency Control, Two-Phase Locking (2PL), Deadlock handling, B+ Tree indexing, and full solutions.',
        fileName: 'BIT_301_Database_Special_Exam_2024.pdf',
        filePath: 'documents/computing/BIT_301_Database_Special_Exam_2024.pdf',
        previewQuestions: [
            '1. Explain how Two-Phase Locking (2PL) guarantees conflict serializability and how strict 2PL prevents cascading rollbacks [12 Marks]',
            '2. Construct a B+ Tree of order 4 inserting keys: 10, 20, 30, 40, 50, 60, 70 [12 Marks]'
        ]
    },

    // BUSINESS & COMMERCE
    // Unit 3: BBA 101 Financial Accounting I
    {
        id: 'bba101-pp-2024',
        faculty: 'School of Business & Economics',
        facultyId: 'business',
        unitCode: 'BBA 101',
        unitName: 'Financial Accounting I',
        title: 'BBA 101: Financial Accounting I - Main Examination (2024)',
        type: 'Past Paper',
        category: 'past-paper',
        price: 200,
        year: 2024,
        semester: 'Semester 1',
        institution: 'School of Business & Economics',
        pages: 6,
        fileSize: '320 KB',
        hasSolutions: true,
        description: 'End of semester paper covering Trial Balance preparation, Bad debts adjustments, Depreciation schedules, and Final Accounts for sole proprietorships.',
        fileName: 'BBA_101_Financial_Accounting_2024_Main.pdf',
        filePath: 'documents/business/BBA_101_Financial_Accounting_2024_Main.pdf',
        previewQuestions: [
            '1. Prepare the Statement of Profit or Loss and Financial Position for Zawadi Enterprises for year ended 31st Dec 2023 [20 Marks]',
            '2. Explain the accounting treatment of depreciation using Reducing Balance vs Straight Line method [10 Marks]'
        ]
    },
    {
        id: 'bba101-cat-2024',
        faculty: 'School of Business & Economics',
        facultyId: 'business',
        unitCode: 'BBA 101',
        unitName: 'Financial Accounting I',
        title: 'BBA 101: CAT 1 - Double Entry System & Bank Reconciliation',
        type: 'CAT',
        category: 'cat',
        price: 25,
        year: 2024,
        semester: 'Semester 1',
        institution: 'Department of Accounting & Finance',
        pages: 2,
        fileSize: '160 KB',
        hasSolutions: true,
        description: 'Test covering ledger postings, 3-column cash book, unpresented cheques, standing orders, and adjusted cash book reconciliations.',
        fileName: 'BBA_101_Financial_Accounting_CAT1_2024.pdf',
        filePath: 'documents/business/BBA_101_Financial_Accounting_CAT1_2024.pdf',
        previewQuestions: [
            '1. Reconcile the cash book balance of Sh. 145,800 with the bank statement showing Sh. 182,300 with step adjustments [20 Marks]'
        ]
    },
    {
        id: 'bba101-special-2024',
        faculty: 'School of Business & Economics',
        facultyId: 'business',
        unitCode: 'BBA 101',
        unitName: 'Financial Accounting I',
        title: 'BBA 101: Special & Supplementary Examination - Financial Accounting I',
        type: 'Special Exam',
        category: 'special',
        price: 250,
        year: 2024,
        semester: 'Special Session',
        institution: 'University Examination Board',
        pages: 6,
        fileSize: '350 KB',
        hasSolutions: true,
        description: 'Official Special exam including Correction of Errors (Suspense Account), Incomplete records, and Partnership accounts with full working papers.',
        fileName: 'BBA_101_Financial_Accounting_Special_2024.pdf',
        filePath: 'documents/business/BBA_101_Financial_Accounting_Special_2024.pdf',
        previewQuestions: [
            '1. Journalize entries to correct six major errors and prepare the Suspense Account [15 Marks]',
            '2. Reconstruct sales and purchases ledger control accounts from single entry records [15 Marks]'
        ]
    },

    // Unit 4: BBA 304 Business Law
    {
        id: 'bba304-pp-2024',
        faculty: 'School of Business & Economics',
        facultyId: 'business',
        unitCode: 'BBA 304',
        unitName: 'Business Law & Commercial Practice',
        title: 'BBA 304: Business Law - Main Examination (2024)',
        type: 'Past Paper',
        category: 'past-paper',
        price: 200,
        year: 2024,
        semester: 'Semester 2',
        institution: 'School of Business & Economics',
        pages: 5,
        fileSize: '280 KB',
        hasSolutions: true,
        description: 'Comprehensive Law paper covering Law of Contract (Offer & Acceptance, Consideration, Capacity, Vitiating factors) and Law of Torts with landmark Kenyan case laws.',
        fileName: 'BBA_304_Business_Law_2024_Main.pdf',
        filePath: 'documents/business/BBA_304_Business_Law_2024_Main.pdf',
        previewQuestions: [
            '1. With reference to decided cases, discuss the doctrine of privity of contract and its recognized exceptions under Kenyan law [15 Marks]',
            '2. Advise Otieno in a dispute regarding breach of condition vs warranty in Sale of Goods Act [15 Marks]'
        ]
    },
    {
        id: 'bba304-cat-2024',
        faculty: 'School of Business & Economics',
        facultyId: 'business',
        unitCode: 'BBA 304',
        unitName: 'Business Law & Commercial Practice',
        title: 'BBA 304: CAT 1 - Sources of Kenyan Law & Law of Torts',
        type: 'CAT',
        category: 'cat',
        price: 25,
        year: 2024,
        semester: 'Semester 2',
        institution: 'School of Business & Economics',
        pages: 3,
        fileSize: '170 KB',
        hasSolutions: true,
        description: 'Continuous assessment test on Constitution, Statutes, Common Law, Negligence (Duty of care, Breach, Causation) and Vicarious Liability.',
        fileName: 'BBA_304_Business_Law_CAT1_2024.pdf',
        filePath: 'documents/business/BBA_304_Business_Law_CAT1_2024.pdf',
        previewQuestions: [
            '1. Explain the neighbor principle enunciated in Donoghue v Stevenson [1892] and its application in modern negligence claims [10 Marks]'
        ]
    },
    {
        id: 'bba304-special-2024',
        faculty: 'School of Business & Economics',
        facultyId: 'business',
        unitCode: 'BBA 304',
        unitName: 'Business Law & Commercial Practice',
        title: 'BBA 304: Special Examination - Business Law & Commercial Practice',
        type: 'Special Exam',
        category: 'special',
        price: 250,
        year: 2024,
        semester: 'Special Session',
        institution: 'University Examination Board',
        pages: 6,
        fileSize: '340 KB',
        hasSolutions: true,
        description: 'Full Special exam on Agency Law, Negotiable Instruments, Insurance principles, and Company formation with model case solutions.',
        fileName: 'BBA_304_Business_Law_Special_2024.pdf',
        filePath: 'documents/business/BBA_304_Business_Law_Special_2024.pdf',
        previewQuestions: [
            '1. Examine the duties of an agent to the principal and circumstances terminating an agency agreement [15 Marks]'
        ]
    },

    // ENGINEERING & APPLIED SCIENCES
    // Unit 5: ENG 101 Engineering Mathematics I
    {
        id: 'eng101-pp-2024',
        faculty: 'School of Engineering & Architecture',
        facultyId: 'engineering',
        unitCode: 'ENG 101',
        unitName: 'Engineering Mathematics I (Calculus & Vectors)',
        title: 'ENG 101: Engineering Mathematics I - Main Examination (2024)',
        type: 'Past Paper',
        category: 'past-paper',
        price: 200,
        year: 2024,
        semester: 'Semester 1',
        institution: 'Faculty of Engineering',
        pages: 5,
        fileSize: '310 KB',
        hasSolutions: true,
        description: 'Complete calculus examination on Partial differentiation, Maclaurin and Taylor series, Integration by parts, and Vector dot/cross products.',
        fileName: 'ENG_101_Engineering_Maths_2024_Main.pdf',
        filePath: 'documents/engineering/ENG_101_Engineering_Maths_2024_Main.pdf',
        previewQuestions: [
            '1. (a) Evaluate limit as x approaches 0 of (sin 3x - 3x) / x^3 using L\'Hopital\'s rule [6 Marks]',
            '1. (b) Find the directional derivative of f(x, y, z) = 2x^2 + y^2 - z at point P(1, 2, 3) along vector 2i + j - 2k [8 Marks]'
        ]
    },
    {
        id: 'eng101-cat-2024',
        faculty: 'School of Engineering & Architecture',
        facultyId: 'engineering',
        unitCode: 'ENG 101',
        unitName: 'Engineering Mathematics I (Calculus & Vectors)',
        title: 'ENG 101: CAT 1 - Limits, Continuity & Implicit Differentiation',
        type: 'CAT',
        category: 'cat',
        price: 25,
        year: 2024,
        semester: 'Semester 1',
        institution: 'Department of Mathematics',
        pages: 2,
        fileSize: '150 KB',
        hasSolutions: true,
        description: 'Assessment on epsilon-delta limits, chain rule, implicit tangents, and extrema optimization.',
        fileName: 'ENG_101_Engineering_Maths_CAT1_2024.pdf',
        filePath: 'documents/engineering/ENG_101_Engineering_Maths_CAT1_2024.pdf',
        previewQuestions: [
            '1. Find dy/dx and d2y/dx2 for curve x^3 + y^3 - 3axy = 0 at point (3a/2, 3a/2) [10 Marks]'
        ]
    },
    {
        id: 'eng101-special-2024',
        faculty: 'School of Engineering & Architecture',
        facultyId: 'engineering',
        unitCode: 'ENG 101',
        unitName: 'Engineering Mathematics I (Calculus & Vectors)',
        title: 'ENG 101: Special & Supplementary Exam - Engineering Mathematics I',
        type: 'Special Exam',
        category: 'special',
        price: 250,
        year: 2024,
        semester: 'Special Session',
        institution: 'University Examination Board',
        pages: 6,
        fileSize: '360 KB',
        hasSolutions: true,
        description: 'Special examination testing improper integrals, reduction formulas, curvature, and radius of curvature with step-by-step calculus proofs.',
        fileName: 'ENG_101_Engineering_Maths_Special_2024.pdf',
        filePath: 'documents/engineering/ENG_101_Engineering_Maths_Special_2024.pdf',
        previewQuestions: [
            '1. Derive the reduction formula for integral of sin^n(x) dx and evaluate integral from 0 to pi/2 of sin^6(x) dx [12 Marks]'
        ]
    },

    // HEALTH & BIOMEDICAL SCIENCES
    // Unit 6: MED 201 Human Anatomy & Physiology
    {
        id: 'med201-pp-2024',
        faculty: 'School of Health & Biomedical Sciences',
        facultyId: 'health',
        unitCode: 'MED 201',
        unitName: 'Human Anatomy & Physiology',
        title: 'MED 201: Human Anatomy & Physiology - Main Examination (2024)',
        type: 'Past Paper',
        category: 'past-paper',
        price: 200,
        year: 2024,
        semester: 'Semester 2',
        institution: 'School of Health Sciences',
        pages: 6,
        fileSize: '380 KB',
        hasSolutions: true,
        description: 'Comprehensive medical exam paper on Cardiovascular hemodynamics, Renal nephron countercurrent multiplier, Neurotransmission, and Endocrine control.',
        fileName: 'MED_201_Human_Anatomy_2024_Main.pdf',
        filePath: 'documents/health/MED_201_Human_Anatomy_2024_Main.pdf',
        previewQuestions: [
            '1. Describe the cardiac cycle phases with reference to Wiggers diagram and pressure-volume loops [15 Marks]',
            '2. Explain the Renin-Angiotensin-Aldosterone System (RAAS) in blood pressure homeostasis [15 Marks]'
        ]
    },
    {
        id: 'med201-cat-2024',
        faculty: 'School of Health & Biomedical Sciences',
        facultyId: 'health',
        unitCode: 'MED 201',
        unitName: 'Human Anatomy & Physiology',
        title: 'MED 201: CAT 1 - Cellular Physiology & Musculoskeletal System',
        type: 'CAT',
        category: 'cat',
        price: 25,
        year: 2024,
        semester: 'Semester 2',
        institution: 'Department of Human Anatomy',
        pages: 3,
        fileSize: '190 KB',
        hasSolutions: true,
        description: 'Test on action potential generation, sliding filament theory of muscle contraction, and synovial joint biomechanics.',
        fileName: 'MED_201_Human_Anatomy_CAT1_2024.pdf',
        filePath: 'documents/health/MED_201_Human_Anatomy_CAT1_2024.pdf',
        previewQuestions: [
            '1. Outline the role of Calcium ions and ATP in the actin-myosin cross-bridge cycle [10 Marks]'
        ]
    },
    {
        id: 'med201-special-2024',
        faculty: 'School of Health & Biomedical Sciences',
        facultyId: 'health',
        unitCode: 'MED 201',
        unitName: 'Human Anatomy & Physiology',
        title: 'MED 201: Special & Supplementary Exam - Anatomy & Physiology',
        type: 'Special Exam',
        category: 'special',
        price: 250,
        year: 2024,
        semester: 'Special Session',
        institution: 'Faculty of Medicine',
        pages: 7,
        fileSize: '410 KB',
        hasSolutions: true,
        description: 'Detailed supplementary exam covering Respiratory gas exchange, Acid-Base balance, and Central Nervous System cranial nerves with complete answers.',
        fileName: 'MED_201_Human_Anatomy_Special_2024.pdf',
        filePath: 'documents/health/MED_201_Human_Anatomy_Special_2024.pdf',
        previewQuestions: [
            '1. Describe the physiological buffering systems defending against metabolic acidosis [15 Marks]'
        ]
    },

    // SCHOOL OF LAW
    // Unit 7: LAW 101 Constitutional & Administrative Law
    {
        id: 'law101-pp-2024',
        faculty: 'School of Law & Governance',
        facultyId: 'law',
        unitCode: 'LAW 101',
        unitName: 'Constitutional Law of Kenya',
        title: 'LAW 101: Constitutional Law - Main Examination (2024)',
        type: 'Past Paper',
        category: 'past-paper',
        price: 200,
        year: 2024,
        semester: 'Semester 1',
        institution: 'School of Law',
        pages: 5,
        fileSize: '295 KB',
        hasSolutions: true,
        description: 'In-depth examination on the 2010 Constitution of Kenya, Devolution, Bill of Rights, Judicial Review, and Separation of Powers.',
        fileName: 'LAW_101_Constitutional_Law_2024_Main.pdf',
        filePath: 'documents/law/LAW_101_Constitutional_Law_2024_Main.pdf',
        previewQuestions: [
            '1. Critically analyze the Basic Structure Doctrine in light of the landmark Supreme Court decision in BBI [2022] [20 Marks]',
            '2. Discuss the grounds for Judicial Review under the Fair Administrative Action Act 2015 [15 Marks]'
        ]
    },
    {
        id: 'law101-cat-2024',
        faculty: 'School of Law & Governance',
        facultyId: 'law',
        unitCode: 'LAW 101',
        unitName: 'Constitutional Law of Kenya',
        title: 'LAW 101: CAT 1 - The Bill of Rights & Constitutionalism',
        type: 'CAT',
        category: 'cat',
        price: 25,
        year: 2024,
        semester: 'Semester 1',
        institution: 'School of Law',
        pages: 3,
        fileSize: '165 KB',
        hasSolutions: true,
        description: 'Test on Article 24 limitation of rights, socio-economic rights jurisprudence, and constitutional supremacy.',
        fileName: 'LAW_101_Constitutional_Law_CAT1_2024.pdf',
        filePath: 'documents/law/LAW_101_Constitutional_Law_CAT1_2024.pdf',
        previewQuestions: [
            '1. Examine the test for proportionality when limiting fundamental freedoms under Article 24 of the Constitution [15 Marks]'
        ]
    },
    {
        id: 'law101-special-2024',
        faculty: 'School of Law & Governance',
        facultyId: 'law',
        unitCode: 'LAW 101',
        unitName: 'Constitutional Law of Kenya',
        title: 'LAW 101: Special & Supplementary Exam - Constitutional Law',
        type: 'Special Exam',
        category: 'special',
        price: 250,
        year: 2024,
        semester: 'Special Session',
        institution: 'School of Law',
        pages: 6,
        fileSize: '330 KB',
        hasSolutions: true,
        description: 'Special paper covering Electoral dispute adjudication, Impeachment proceedings of Governors/President, and independent commissions.',
        fileName: 'LAW_101_Constitutional_Law_Special_2024.pdf',
        filePath: 'documents/law/LAW_101_Constitutional_Law_Special_2024.pdf',
        previewQuestions: [
            '1. Evaluate the constitutional thresholds for impeachment under Chapter Eleven and Article 181 [20 Marks]'
        ]
    }
];

// Write materials.json
fs.writeFileSync(path.join(__dirname, 'data', 'materials.json'), JSON.stringify(materials, null, 2), 'utf8');
console.log(`Saved ${materials.length} exam materials to data/materials.json`);

// Create physical PDF files for each document
materials.forEach(item => {
    const fullPath = path.join(__dirname, item.filePath);
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const buffer = createPdfBuffer(item);
    fs.writeFileSync(fullPath, buffer);
    console.log(`Generated: ${item.filePath} (${buffer.length} bytes)`);
});
