# Course — University Exam Resource Marketplace

Course is Kenya's premier student exam resource portal, designed to give students instant access to revision materials, complete past examination papers, continuous assessment tests (CATs), and special/supplementary examinations with worked solutions and marking schemes.

---

## Fixed Official Pricing Structure

In line with the brand guidelines, all academic resources are strictly priced as:
* **Past Papers (End-of-Semester Examinations + Marking Schemes)**: **KES 200**
* **CATS (Continuous Assessment Tests + Solutions)**: **KES 25**
* **SPECIAL (Special & Supplementary Examinations + Examiner Rubrics)**: **KES 250**

---

## Catalog & Folder-Based Document Architecture

Exam documents are catalogued and presented as interactive folders with their respective PDF files:

```
Course/
├── School of Computing & Informatics/
│   ├── BCS 201: Data Structures and Algorithms/
│   │   ├── [Folder] Past Papers (KES 200) -> BCS_201_Data_Structures_2024_Main_Exam.pdf
│   │   ├── [Folder] CATS (KES 25) -> BCS_201_Data_Structures_CAT1_2024.pdf
│   │   └── [Folder] Special Exams (KES 250) -> BCS_201_Data_Structures_Special_Exam_2024.pdf
│   └── BIT 301: Database Management Systems/
│       ├── [Folder] Past Papers (KES 200)
│       ├── [Folder] CATS (KES 25)
│       └── [Folder] Special Exams (KES 250)
├── School of Business & Economics/
│   ├── BBA 101: Financial Accounting I/
│   └── BBA 304: Business Law & Commercial Practice/
├── School of Engineering & Architecture/
│   └── ENG 101: Engineering Mathematics I (Calculus)/
├── School of Health & Biomedical Sciences/
│   └── MED 201: Human Anatomy & Physiology/
└── School of Law & Governance/
    └── LAW 101: Constitutional Law of Kenya/
```

Every document item is backed by a genuine, verified PDF document in the `documents/` directory.

---

## Lipa Na M-Pesa Payment Pipeline & STK Push

Course features a complete, direct M-Pesa STK Push payment pipeline:

1. **One-Click STK Push / Multi-Item Cart Checkout**:
   - Single item instant purchase or shopping cart bundle.
   - Student enters their Safaricom phone number (e.g., `0712345678` or `0112345678`).
2. **PayHero Kenya API v2 Integration (Direct to Phone / Till / Paybill)**:
   - Endpoint: `POST https://backend.payhero.co.ke/api/v2/payments`
   - Real STK Push directly to customer handset without requiring an expensive business shortcode.
   - Live transaction polling via `GET https://backend.payhero.co.ke/api/v2/transactions?external_reference={orderId}`.
   - Webhook callback receiver (`/api/mpesa/callback`) for asynchronous transaction confirmation.
   - Channel detection: Supports Bank Paybill (e.g. NCBA LOOP) and Buy Goods Till numbers.
3. **Interactive Phone STK Push Simulator & Fallback**:
   - Built-in visual Safaricom SIM Toolkit simulator that replicates the phone prompt on-screen.
   - Works immediately out-of-the-box in local development or offline test environments.
4. **Immediate PDF Delivery & Receipt**:
   - Real-time status update via polling & Server-Sent Events (SSE).
   - Generates an official M-Pesa receipt number (e.g., `EE-SHB829128` or real Safaricom receipt like `UHHD73T4BC`).
   - Issues a secure download token allowing the student to instantly view and download their verified PDF.
5. **"My Downloads" Order Recovery**:
   - Students can enter their phone number or receipt number anytime to re-download previously purchased exam papers.

---

## Running Course

Start the server:
```bash
npm start
# or: node server.js
```

- **Student Marketplace**: [http://localhost:3000](http://localhost:3000)
- **Vendor / Admin Console**: [http://localhost:3000/vender.html](http://localhost:3000/vender.html)
- **API Base**: [http://localhost:3000/api/materials](http://localhost:3000/api/materials)

To regenerate catalog materials or add custom test PDFs:
```bash
node generate_catalog.js
```
