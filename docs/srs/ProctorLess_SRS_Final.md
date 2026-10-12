![][image1]  
**Adaptive Smart Assessment and Integrity Detection System (ProctorLess)**

Final Version  
**Course Title: Web Application and Internet**  
**Course ID: CSE309**  
**Section: 01**  
**Semester: Autumn 2025**  
**Submitted To: Md. Abu Sayed**  
**Submitted By:**

| Name | ID |
| :---: | :---: |
| **Taif Ur Rahman** | **2210280** |
| **Md. Jamiul Islam Nahin** | **2210514** |

**Submission Date: December 13, 2025**

# **Table of Contents**

The Project SRS Approval Letter	2

1\. Introduction	3

    1.1 Purpose	3

    1.2 Scope of Work	3

    1.3 Intended Audience	3

    1.4 Definitions, Acronyms, and Abbreviations	3

2\. General Description	4

    2.1 Product Perspective and System Architecture	4

    2.2 User Characteristics	4

    2.3 Data Collection and Framework	4

3\. Functional Requirements	5

    3.1 Authentication and Roles	5

    3.2 Course Management	5

    3.3 Quiz Management	5

    3.4 Student Quiz Engine	5

    3.5 Integrity Monitoring	6

    3.6 Results and Grading	6

    3.7 Administration	6

    3.8 API Integration	6

4\. Interface Requirements	7

    4.1 User Interface (HCI Layer)	7

    4.2 Software Interfaces	7

5\. Non-Functional Attributes	7

    5.1 Security	7

    5.2 Performance and Reliability	8

    5.3 Privacy and Compliance	8

6\. Risk Management	8

7\. Change Management Process	9

8\. Preliminary Schedule and Budget	9

9\. Conclusion	9

# 

# **The Project SRS Approval Letter**

I ……………………………………. understand that this SRS contains all the Software Requirement Analysis that has been precisely documented for understanding how the ProctorLess Platform will operate in the real world. I also understand that by approving this SRS, I will not be able to add further requirements to the ProctorLess Platform. I am hereby providing my authorization to proceed with the design and development phase.

Name: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Designation: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Signature: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

Date: \_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_

# 

# **1\. Introduction**

The Introduction section sets the stage by defining the document's purpose, scope, audience, and key terms, ensuring a unified understanding among stakeholders.

## **1.1 Purpose**

The primary purpose of this SRS is to define complete, clear, and testable requirements for ProctorLess, an adaptive online assessment system. It aims to gain agreement with stakeholders regarding the system's functionality, which centers on role-based dashboards, real-time integrity monitoring, and AI-assisted capabilities.

## **1.2 Scope of Work (Project Overview)**

The project involves the development of a web application designed for creating and taking quizzes within a structured course environment. It features role-based administration, providing distinct dashboards for students, professors, and administrators. A key component is the real-time integrity monitoring system, which utilizes a privacy-first browser extension to detect tab switching without invasive surveillance. Additionally, the system integrates AI capabilities to assist in generating quiz variations and automating the grading process, thereby streamlining the assessment workflow.

## **1.3 Intended Audience**

This document is intended for the development team, project managers, QA engineers, and academic stakeholders. It is organized to guide implementation and testing, serving as the primary reference for system behavior.

## **1.4 Definitions, Acronyms, and Abbreviations**

The document uses standard software engineering terminology alongside project-specific terms. SRS refers to Software Requirements Specification. HCI stands for Human-Computer Interaction. Supabase is the Backend-as-a-Service provider used for database, authentication, and realtime features. AI refers to the Artificial Intelligence integrations powered by Google Gemini via Edge Functions.

# **2\. General Description**

## **2.1 Product Perspective and System Architecture**

The system relies on a modern web architecture using Next.js 16 (App Router) for the frontend and React 19 for the user interface components. The backend infrastructure is managed by Supabase, which handles Authentication, Database, Storage, and Realtime subscriptions. A dedicated Chrome browser extension serves as the integrity monitoring agent, communicating tab-switch events directly to the backend. AI features are decoupled into Supabase Edge Functions that securely interact with Gemini APIs.

## **2.2 User Characteristics**

The system supports three distinct user classes. Students require a clear, distraction-free interface for taking timed quizzes with assurance that their progress is autosaved. Professors need efficient workflows for creating courses, managing question banks, and reviewing AI-assisted grades. Administrators require high-level oversight tools to manage user roles and audit system health.

## **2.3 Data Collection and Framework**

Data collection focuses on academic assets and integrity logs. Question banks and grading artifacts are stored in designated storage buckets, while relational data such as user profiles, course associations, and quiz submissions are maintained in the Postgres database. Integrity data is strictly limited to timestamped events of tab switching, with specific exclusions for 'allowed websites' to prevent false positives.

**2.4 Survey/Validation:**

To ensure the system addresses real-world academic integrity challenges, requirements were validated through competitive analysis of existing proctoring tools and feedback from academic stakeholders. The analysis highlighted a critical need for non-invasive monitoring (privacy-first) and faster grading workflows, directly influencing the inclusion of the 'Integrity Monitor' extension and AI grading features.

# **3\. Functional Requirements**

These sections define the specific activities the system must perform.

## **3.1 Authentication and Roles**

The system shall handle user authentication securely via Supabase Auth. Upon registration or assignment, the system shall associate each user with a single specific role: student, professor, or admin. Immediately following a successful login, the system shall strictly route the user to their role-appropriate dashboard, ensuring no unauthorized access to administrative or professorial views.

## **3.2 Course Management**

Professors shall have the ability to create new courses by providing a title and description. To facilitate enrollment, the system shall generate unique join codes for every course. Students shall be able to join these courses by entering a valid code, after which the system will grant them access to the course content.

## **3.3 Quiz Management**

The system shall enable professors to create quizzes linked to specific courses and configure integrity settings, including the definition of allowed websites. Professors shall upload question banks, which the system shall parse using OCR or AI extraction techniques. Furthermore, the system shall support the generation of quiz variations from a master question set to prevent cheating.

## **3.4 Student Quiz Engine**

During an assessment, the system shall present questions in a randomized order from the configured bank. To prevent data loss, the system shall autosave answers periodically and whenever a change is detected. The system shall enforce all timing constraints and automatically submit the quiz when the time expires, persisting the submission with a unique identifier.

## **3.5 Integrity Monitoring**

The integrity monitoring relies on a browser extension that shall detect tab switches whenever the monitoring mode is armed. The system shall record these events with timestamps and referrer context but shall exclude any websites explicitly listed in the 'allowed' configuration. These integrity events shall be displayed on the results dashboard for professor review.

## **3.6 Results and Grading**

The system shall display a list of submissions and grades for every quiz. Professors shall have the option to invoke AI-assisted grading via a Supabase Edge Function, which provides preliminary scores and feedback. Professors shall retain the ability to override these grades manually and save the final results. Summary statistics for both grades and integrity violations shall be provided.

## **3.7 Administration**

Admins shall have exclusive access to manage the user base, including the ability to create, delete, and assign roles to user accounts. The admin dashboard shall provide overview statistics of total users, quizzes, and submissions, along with the capability to browse and audit lists of courses and quizzes.

## **3.8 API Integration**

The system shall provide secure REST endpoints for AI operations, including extracting questions from files and generating quiz variations. All payloads sent to these endpoints shall be validated, and responses shall be structured in a normalized format for frontend consumption.

# **4\. Interface Requirements**

## **4.1 User Interface (HCI Layer)**

The user interface shall adhere to a minimal, academic design philosophy with high-contrast text and responsive layouts. Navigation shall be strictly role-based, ensuring users only see options relevant to their tasks. Administrative interfaces shall use tabbed layouts to organize complex data tables efficiently.

## **4.2 Software Interfaces**

The system interfaces with Supabase for all backend operations, including Auth, Database, and Realtime features. External AI services are accessed via secure API endpoints (e.g., /api/gemini/extract). Data exchange occurs via JSON over HTTPS, with assets stored in specific Storage buckets.

**4.3 Hardware:**

Since the application is web-based, it requires no specialized hardware. Users (students and professors) only require a standard computer (Desktop or Laptop) with an active internet connection (Wi-Fi or Ethernet) and a modern web browser to access the system.

# 

# **5\. Non-Functional Attributes**

## **5.1 Security**

The system shall implement robust security measures, including role-based authorization for all protected routes. Secrets and API keys shall be stored server-side and never exposed to the client. Row Level Security (RLS) policies shall be applied to the database to ensure data isolation.

## **5.2 Performance and Reliability**

The system shall ensure that 95% of dashboard loads complete within 2 seconds on standard broadband connections. Quiz autosaving mechanisms must complete within 1 second to ensure a seamless student experience. Realtime subscriptions shall automatically reconnect in the event of transient network failures.

## **5.3 Privacy and Compliance**

To maintain student privacy, the integrity monitoring extension shall only log data during active quiz sessions and must strictly exclude allowed domains from violation logs. No webcam or biometric data shall be collected.

# **6\. Risk Management**

This section describes the strategies and methods used to identify and avoid potential risks throughout the life cycle of the "ProctorLess" project .

**6.1 Purpose and Scope** 

Risk management must identify all kinds of risks associated with the project. The goal is to monitor the project closely to prevent common risk factors that historically cause project failure . Risk factors are associated with three main areas:

1. **Nature of the work:** The scope of the solution and the target environment.  
2. **Project and Team Environment:** Internal dynamics and resources.  
3. **Technical Aspects:** Risks involved with the system technology. For ProctorLess, technical risks relate heavily to the integration of the **Gemini AI API** and the **Chrome Extension architecture** .

**6.2 Major Identified Risk Factors** 

The following common risk factors must be closely monitored:

1. **Personnel Shortfalls:** Inadequate staffing or loss of key personnel.  
2. **Unrealistic Schedules:** Overly aggressive planning or deadlines.  
3. **Developing the Wrong User Interface:** A critical risk for this project, as the academic dashboard must be minimal and high-contrast for clarity.  
4. **Gold Plating:** Adding more functionality or features than necessary (e.g., adding complex biometric tracking beyond simple tab monitoring).  
5. **Continuing Stream of Requirements Changes:** Frequent, unmanaged changes that destabilize the scope.  
6. **Real-Time Performance Shortfalls:** Failure to meet performance expectations (e.g., the browser extension must log events instantly without lagging the student's browser).

# **7\. Change Management Process**

The requirement change management process defines the set of activities that need to be performed when there are new requirements or changes to existing requirements.

**7.1 Goal and Responsibility Goal:** 

The basic goal is to control requirement changes and minimize the impact of changes on the project. The process tries to ensure that a project succeeds despite requirement changes . **Responsibility:** The project team leader is primarily responsible for executing the process to incorporate the change in the project.

**7.2 Change Management Process Steps** 

The process requires the execution of the following major steps when a requirement change request is received:

1. **Log Changes:** A change request log will be maintained.  
2. **Perform Impact Analysis:** Analyze the change on the work products (DB schema, API endpoints).  
3. **Estimate Effort:** Estimate the effort needed for this change request.  
4. **Re-estimate Delivery Schedule**.  
5. **Perform Cumulative Cost Impact Analysis**.  
6. **Review Impact** with stakeholders if thresholds are exceeded.  
7. **Obtain Sign-Off**.  
8. **Rework Work Products**.

**7.3 Documentation and Control**

1. **Change Log:** The change request log will track each request, including the request number, description, impact, and status.  
2. **SRS Modification:** The change request is incorporated into the requirement specification document, usually as appendices.  
3. **Monitoring:** Monitoring of approved change requests ensures proper implementation and allows the team to deliver the ProctorLess application in a timely manner .

# **8\. Preliminary Schedule and Budget**

The project schedule is derived from the technical design phases, covering Authentication, Course Management, Quiz Engine, Integrity Monitoring, and AI Integration. The budget relies on free-tier services (Supabase, Vercel), with potential costs allocated for AI API usage, managed via strict quota limits.

# **9\. Conclusion**

This SRS outlines the design and requirements for ProctorLess, a secure and adaptive assessment platform. By leveraging Next.js for the interface and Supabase for backend reliability, coupled with AI-driven grading, the system aims to modernize academic testing while maintaining integrity. This document serves as the primary reference for the development and testing phases.

#### **Appendices**

**A. Glossary of Terms**

* **SRS:** Software Requirements Specification – A document that describes what the software will do and how it will be expected to perform.  
* **HCI:** Human-Computer Interaction – The design and implementation of the user interface, focusing on user experience.  
* **Supabase:** The Backend-as-a-Service (BaaS) provider used for the project's database, authentication, and realtime features.  
* **Integrity Event:** A specific logged instance where the browser extension detects a user switching tabs away from the active quiz.  
* **Edge Function:** Serverless functions (hosted on Supabase) used to securely call external AI APIs like Gemini.  
* **Next.js:** The React framework used for building the frontend of the application.

**B. Document Revision History** 

A log detailing the version number, date of release, and activity for each revision

| Version | Date | Description | Author |
| :---- | ----- | :---- | :---- |
| v1.0 | December 13, 2025 | Initial Final Release | Taif Ur Rahman |

**C. Change Log** 

A log maintained to keep track of all change requests.

| Change ID | Description | Impact Analysis | Status |
| :---- | :---- | :---- | :---- |
| CL-001 | Consolidated admin panel into a single /dashboard view instead of separate dropdown links. | Reduced navigation complexity; required updating routing logic. | Approved |
| CL-002 | Integrated OCR/Gemini parsing for question bank uploads. | Added dependency on external AI API; required error handling for timeouts. | Approved |
| CL-003 | Added "Allowed Websites" whitelist to Integrity Monitor. | Reduced false positives in integrity logs; required schema update for Quiz settings. | Approved |

#### 

#### 

#### **Uses of SRS Document**

The SRS serves multiple critical functions for the project team and stakeholders. It acts as a complete and precise documentation for understanding exactly how the system will operate in the real world. It describes the functional and non-functional requirements of the proposed system in substantial detail.

It defines how the application will interact with system hardware, other programs, and human users in a wide variety of real-world situations. The SRS minimizes the time and effort required to achieve desired goals and helps minimize development costs. Once approved, it guides the project personnel in understanding the project and management structure more clearly.

#### **FAQs on SRS Format**

The SRS format is standardized to ensure clarity and comprehensiveness.

**Q1: What is the primary content of an SRS?** **Ans:** An SRS is fundamentally a description of the software system to be developed. It clearly lays out the functional requirements and the non-functional requirements (or software attributes).

**Q2: Does the SRS detail implementation specifics?** **Ans:** The SRS focuses on *what* the software must do and how it will perform. While it outlines the development technology and architectural approach (like Next.js or Supabase), the detailed design and implementation specifics are often documented elsewhere, or in the Specific Requirements section.

**Q3: Why are non-functional attributes important?** **Ans:** Non-functional attributes (like security, response time, scalability, portability) define the quality and constraints of the system. These parameters are crucial for ensuring the system is robust and meets real-world expectations beyond just its core features.

[image1]: <data:image/png;base64,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>