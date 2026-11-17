require('dotenv').config();
const dns = require('dns');
try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch (e) {}
const mongoose = require('mongoose');
const User = require('./models/User');
const Book = require('./models/Book');
const BookCopy = require('./models/BookCopy');
const Circulation = require('./models/Circulation');
const ServiceRequest = require('./models/ServiceRequest');
const Fine = require('./models/Fine');
const Notification = require('./models/Notification');
const Setting = require('./models/Setting');

const seedData = async () => {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/library_system';
    console.log(`[Seed] Connecting to MongoDB: ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('[Seed] Connected successfully.');

    // Clear existing collections
    console.log('[Seed] Clearing existing collections...');
    await Promise.all([
      User.deleteMany({}),
      Book.deleteMany({}),
      BookCopy.deleteMany({}),
      Circulation.deleteMany({}),
      ServiceRequest.deleteMany({}),
      Fine.deleteMany({}),
      Notification.deleteMany({}),
      Setting.deleteMany({})
    ]);

    // 1. Seed Settings (SRS Configurable rules)
    console.log('[Seed] Creating default system settings...');
    const config = await Setting.create({
      key: 'default_config',
      maxBooksPerPatron: 3,
      loanPeriodDays: 14,
      fineRatePerDay: 5,
      libraryName: 'Department of Computer Science Library, AMU'
    });

    // 2. Seed Users (Staff & Patrons)
    console.log('[Seed] Creating staff and patron accounts...');
    const staffUser = await User.create({
      userId: 'LIB-001',
      name: 'Librarian Staff Admin',
      email: 'staff@amu.ac.in',
      password: 'staff123',
      role: 'STAFF',
      accountStatus: 'ACTIVE',
      department: 'Computer Science Library',
      phone: '+91 9876543210'
    });

    // Author / Student Patron from SRS
    const studentPatron = await User.create({
      userId: 'PAT-2026-0001',
      name: 'Prince Kaushal',
      email: 'student@amu.ac.in',
      password: 'student123',
      role: 'PATRON',
      accountStatus: 'ACTIVE',
      department: 'Computer Science',
      enrollmentNo: 'Gr0683',
      phone: '+91 9123456789'
    });

    const facultyPatron = await User.create({
      userId: 'PAT-2026-0002',
      name: 'Dr. Tariq Ahmad',
      email: 'tariq@amu.ac.in',
      password: 'patron123',
      role: 'PATRON',
      accountStatus: 'ACTIVE',
      department: 'Computer Science (Faculty)',
      enrollmentNo: 'FAC-CS-09',
      phone: '+91 9456781234'
    });

    // 3. Seed Books Catalog (Title level)
    console.log('[Seed] Creating books catalog...');
    const bookData = [
      {
        bookId: 'BK-1001',
        title: 'Introduction to Algorithms',
        author: 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein',
        category: 'Algorithms & Data Structures',
        isbn: '978-0262033848',
        publisher: 'MIT Press',
        edition: '3rd Edition',
        shelfLocation: 'Stack CS-1, Rack A',
        totalCopies: 10, // Explicitly 10 copies as requested by mentor!
        availableCopies: 9,
        availability: true,
        description: 'Comprehensive textbook covering data structures, sorting, graph algorithms, and dynamic programming.'
      },
      {
        bookId: 'BK-1002',
        title: 'Operating System Concepts',
        author: 'Abraham Silberschatz, Peter B. Galvin, Greg Gagne',
        category: 'Operating Systems',
        isbn: '978-1118063330',
        publisher: 'Wiley',
        edition: '10th Edition',
        shelfLocation: 'Stack CS-2, Rack B',
        totalCopies: 5,
        availableCopies: 4,
        availability: true,
        description: 'Foundational guide to processes, CPU scheduling, synchronization, memory management, and file systems.'
      },
      {
        bookId: 'BK-1003',
        title: 'Database System Concepts',
        author: 'Abraham Silberschatz, Henry F. Korth, S. Sudarshan',
        category: 'Database Management',
        isbn: '978-0078022159',
        publisher: 'McGraw-Hill',
        edition: '7th Edition',
        shelfLocation: 'Stack CS-3, Rack A',
        totalCopies: 6,
        availableCopies: 6,
        availability: true,
        description: 'Covers relational databases, SQL, normalization, transaction processing, indexing, and NoSQL architecture.'
      },
      {
        bookId: 'BK-1004',
        title: 'Computer Networks: A Top-Down Approach',
        author: 'James F. Kurose, Keith W. Ross',
        category: 'Computer Networks',
        isbn: '978-0133594140',
        publisher: 'Pearson',
        edition: '7th Edition',
        shelfLocation: 'Stack CS-4, Rack C',
        totalCopies: 4,
        availableCopies: 4,
        availability: true,
        description: 'Focuses on application layer down to link layer, TCP/IP protocols, sockets, and internet infrastructure.'
      },
      {
        bookId: 'BK-1005',
        title: 'Artificial Intelligence: A Modern Approach',
        author: 'Stuart Russell, Peter Norvig',
        category: 'Artificial Intelligence',
        isbn: '978-0136042594',
        publisher: 'Pearson',
        edition: '4th Edition',
        shelfLocation: 'Stack CS-5, Rack D',
        totalCopies: 2,
        availableCopies: 0,
        availability: false,
        description: 'The standard reference for search algorithms, knowledge representation, probabilistic reasoning, and machine learning.'
      },
      {
        bookId: 'BK-1006',
        title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        author: 'Robert C. Martin',
        category: 'Software Engineering',
        isbn: '978-0132350884',
        publisher: 'Prentice Hall',
        edition: '1st Edition',
        shelfLocation: 'Stack CS-1, Rack E',
        totalCopies: 3,
        availableCopies: 3,
        availability: true,
        description: 'Best practices for writing readable, maintainable, modular, and testable object-oriented code.'
      },
      {
        bookId: 'BK-1007',
        title: 'Web Development with Node and Express',
        author: 'Ethan Brown',
        category: 'Web Technologies',
        isbn: '978-1491956663',
        publisher: "O'Reilly Media",
        edition: '2nd Edition',
        shelfLocation: 'Stack CS-6, Rack B',
        totalCopies: 4,
        availableCopies: 4,
        availability: true,
        description: 'Practical guide to building REST APIs, middleware architectures, templates, and full-stack web applications.'
      },
      {
        bookId: 'BK-1008',
        title: 'Compilers: Principles, Techniques, and Tools',
        author: 'Alfred V. Aho, Monica S. Lam, Ravi Sethi, Jeffrey D. Ullman',
        category: 'Theory of Computation',
        isbn: '978-0321486813',
        publisher: 'Addison-Wesley',
        edition: '2nd Edition',
        shelfLocation: 'Stack CS-2, Rack F',
        totalCopies: 3,
        availableCopies: 3,
        availability: true,
        description: 'The classic Dragon Book on lexical analysis, parsing, semantic analysis, code generation, and optimization.'
      },
      {
        bookId: 'BK-1009',
        title: 'Programming in ANSI C',
        author: 'E. Balagurusamy',
        category: 'Programming in C',
        isbn: '978-9353165130',
        publisher: 'McGraw-Hill Education',
        edition: '8th Edition',
        shelfLocation: 'Stack BCA-1, Rack A',
        totalCopies: 6,
        availableCopies: 6,
        availability: true,
        description: 'Comprehensive guide to C programming language covering variables, control structures, pointers, arrays, structures, and file management.'
      },
      {
        bookId: 'BK-1010',
        title: 'Object-Oriented Programming with C++',
        author: 'E. Balagurusamy',
        category: 'Object-Oriented Programming',
        isbn: '978-9389949186',
        publisher: 'McGraw-Hill Education',
        edition: '8th Edition',
        shelfLocation: 'Stack BCA-1, Rack B',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'Fundamental principles of OOP, classes, objects, inheritance, polymorphism, templates, exception handling, and STL in C++.'
      },
      {
        bookId: 'BK-1011',
        title: 'Java: The Complete Reference',
        author: 'Herbert Schildt',
        category: 'Java Programming',
        isbn: '978-1260440232',
        publisher: 'Oracle Press / McGraw-Hill',
        edition: '12th Edition',
        shelfLocation: 'Stack CS-4, Rack A',
        totalCopies: 7,
        availableCopies: 7,
        availability: true,
        description: 'Complete coverage of Java SE, multi-threading, collections framework, generics, lambda expressions, streams, and networking APIs.'
      },
      {
        bookId: 'BK-1012',
        title: 'Python Crash Course',
        author: 'Eric Matthes',
        category: 'Python Programming',
        isbn: '978-1718502703',
        publisher: 'No Starch Press',
        edition: '3rd Edition',
        shelfLocation: 'Stack CS-4, Rack B',
        totalCopies: 6,
        availableCopies: 6,
        availability: true,
        description: 'Hands-on project-based introduction to Python, data analysis, web applications with Django, APIs, and data visualization.'
      },
      {
        bookId: 'BK-1013',
        title: 'Data Structures and Algorithms in C++',
        author: 'Adam Drozdek',
        category: 'Algorithms & Data Structures',
        isbn: '978-1133608424',
        publisher: 'Cengage Learning',
        edition: '4th Edition',
        shelfLocation: 'Stack CS-1, Rack C',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'In-depth exploration of stacks, queues, linked lists, binary trees, AVL trees, graphs, sorting techniques, and memory management.'
      },
      {
        bookId: 'BK-1014',
        title: 'Discrete Mathematics and Its Applications',
        author: 'Kenneth H. Rosen',
        category: 'Discrete Mathematics',
        isbn: '978-1259676512',
        publisher: 'McGraw-Hill Education',
        edition: '8th Edition',
        shelfLocation: 'Stack BCA-2, Rack A',
        totalCopies: 8,
        availableCopies: 8,
        availability: true,
        description: 'Essential mathematical foundation covering propositional logic, set theory, combinatorics, graph theory, trees, and Boolean algebra.'
      },
      {
        bookId: 'BK-1015',
        title: 'Computer System Architecture',
        author: 'M. Morris Mano',
        category: 'Computer Architecture',
        isbn: '978-0131755635',
        publisher: 'Pearson',
        edition: '3rd Edition',
        shelfLocation: 'Stack BCA-2, Rack B',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'Register transfer logic, microprogrammed control, central processing unit design, pipeline and vector processing, memory organization, and I/O.'
      },
      {
        bookId: 'BK-1016',
        title: "Software Engineering: A Practitioner's Approach",
        author: 'Roger S. Pressman, Bruce R. Maxim',
        category: 'Software Engineering',
        isbn: '978-1259872976',
        publisher: 'McGraw-Hill Education',
        edition: '9th Edition',
        shelfLocation: 'Stack CS-3, Rack C',
        totalCopies: 6,
        availableCopies: 6,
        availability: true,
        description: 'Standard textbook for software lifecycle models, agile methodologies, requirements engineering, architectural design, testing, and DevOps.'
      },
      {
        bookId: 'BK-1017',
        title: 'Introduction to Automata Theory, Languages, and Computation',
        author: 'John E. Hopcroft, Rajeev Motwani, Jeffrey D. Ullman',
        category: 'Theory of Computation',
        isbn: '978-0321455369',
        publisher: 'Pearson',
        edition: '3rd Edition',
        shelfLocation: 'Stack CS-2, Rack D',
        totalCopies: 4,
        availableCopies: 4,
        availability: true,
        description: 'Formal language theory, finite automata, regular expressions, context-free grammars, pushdown automata, Turing machines, and decidability.'
      },
      {
        bookId: 'BK-1018',
        title: 'Machine Learning',
        author: 'Tom M. Mitchell',
        category: 'Machine Learning',
        isbn: '978-0070428072',
        publisher: 'McGraw-Hill Education',
        edition: '1st Edition',
        shelfLocation: 'Stack CS-5, Rack B',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'Classic textbook on decision trees, neural networks, Bayesian learning, computational learning theory, genetic algorithms, and reinforcement learning.'
      },
      {
        bookId: 'BK-1019',
        title: 'Pattern Recognition and Machine Learning',
        author: 'Christopher M. Bishop',
        category: 'Machine Learning & AI',
        isbn: '978-0387310732',
        publisher: 'Springer',
        edition: '1st Edition',
        shelfLocation: 'Stack CS-5, Rack C',
        totalCopies: 4,
        availableCopies: 4,
        availability: true,
        description: 'Comprehensive probabilistic approach to machine learning, support vector machines, kernel methods, graphical models, and continuous latent variables.'
      },
      {
        bookId: 'BK-1020',
        title: 'Cloud Computing: Principles and Paradigms',
        author: 'Rajkumar Buyya, Christian Vecchiola, S. Thamarai Selvi',
        category: 'Cloud Computing',
        isbn: '978-0470887998',
        publisher: 'Wiley',
        edition: '1st Edition',
        shelfLocation: 'Stack CS-6, Rack C',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'Virtualization architecture, hypervisors, cloud storage, IaaS, PaaS, SaaS models, cloud federation, resource management, and SLA enforcement.'
      },
      {
        bookId: 'BK-1021',
        title: 'Cryptography and Network Security: Principles and Practice',
        author: 'William Stallings',
        category: 'Cyber Security',
        isbn: '978-0135764039',
        publisher: 'Pearson',
        edition: '8th Edition',
        shelfLocation: 'Stack CS-6, Rack D',
        totalCopies: 6,
        availableCopies: 6,
        availability: true,
        description: 'Symmetric encryption, DES, AES, public-key cryptography, RSA, digital signatures, message authentication codes, SSL/TLS, and network firewalls.'
      },
      {
        bookId: 'BK-1022',
        title: 'Computer Graphics: Principles and Practice',
        author: 'James D. Foley, Andries van Dam, Steven K. Feiner, John F. Hughes',
        category: 'Computer Graphics',
        isbn: '978-0321399526',
        publisher: 'Addison-Wesley',
        edition: '3rd Edition',
        shelfLocation: 'Stack BCA-3, Rack A',
        totalCopies: 4,
        availableCopies: 4,
        availability: true,
        description: 'Foundational raster algorithms, 2D and 3D geometric transformations, viewing pipelines, illumination models, shading, ray tracing, and OpenGL.'
      },
      {
        bookId: 'BK-1023',
        title: 'HTML and CSS: Design and Build Websites',
        author: 'Jon Duckett',
        category: 'Web Technologies',
        isbn: '978-1118008188',
        publisher: 'Wiley',
        edition: '1st Edition',
        shelfLocation: 'Stack BCA-3, Rack B',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'Visual reference guide covering semantic HTML5 markup, modern CSS3 layout techniques, Flexbox, CSS Grid, typography, and responsive design.'
      },
      {
        bookId: 'BK-1024',
        title: 'JavaScript: The Definitive Guide',
        author: 'David Flanagan',
        category: 'Web Technologies',
        isbn: '978-1491952023',
        publisher: "O'Reilly Media",
        edition: '7th Edition',
        shelfLocation: 'Stack CS-4, Rack C',
        totalCopies: 6,
        availableCopies: 6,
        availability: true,
        description: 'Master guide to modern ECMAScript standards, closures, prototypes, asynchronous programming, promises, async/await, DOM, and Node.js.'
      },
      {
        bookId: 'BK-1025',
        title: 'Full Stack Development with React and Node.js',
        author: 'Carl M. Smith',
        category: 'Web Technologies',
        isbn: '978-1801815154',
        publisher: 'Packt Publishing',
        edition: '2nd Edition',
        shelfLocation: 'Stack CS-6, Rack A',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'Building end-to-end full-stack applications with React frontend, Express REST APIs, MongoDB Mongoose ODM, JWT authentication, and Docker.'
      },
      {
        bookId: 'BK-1026',
        title: 'Systems Analysis and Design',
        author: 'Alan Dennis, Barbara Haley Wixom, Roberta M. Roth',
        category: 'Systems Analysis',
        isbn: '978-1119496489',
        publisher: 'Wiley',
        edition: '7th Edition',
        shelfLocation: 'Stack BCA-4, Rack A',
        totalCopies: 4,
        availableCopies: 4,
        availability: true,
        description: 'Feasibility analysis, requirements gathering, use case diagrams, data flow diagrams (DFD), system architecture design, and user interface design.'
      },
      {
        bookId: 'BK-1027',
        title: 'Fundamentals of Database Systems',
        author: 'Ramez Elmasri, Shamkant B. Navathe',
        category: 'Database Management',
        isbn: '978-0133970777',
        publisher: 'Pearson',
        edition: '7th Edition',
        shelfLocation: 'Stack CS-3, Rack B',
        totalCopies: 6,
        availableCopies: 6,
        availability: true,
        description: 'Comprehensive guide to ER modeling, relational algebra, SQL DDL/DML, functional dependencies, normal forms (1NF-BCNF), and concurrency control.'
      },
      {
        bookId: 'BK-1028',
        title: 'Digital Logic and Computer Design',
        author: 'M. Morris Mano',
        category: 'Digital Electronics',
        isbn: '978-9332542525',
        publisher: 'Pearson',
        edition: '1st Edition',
        shelfLocation: 'Stack BCA-1, Rack C',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'Boolean algebra, logic gates, Karnaugh maps, combinational circuits, multiplexers, decoders, sequential circuits, flip-flops, counters, and registers.'
      },
      {
        bookId: 'BK-1029',
        title: 'Data Mining: Concepts and Techniques',
        author: 'Jiawei Han, Micheline Kamber, Jian Pei',
        category: 'Data Mining & Big Data',
        isbn: '978-0123814791',
        publisher: 'Morgan Kaufmann',
        edition: '3rd Edition',
        shelfLocation: 'Stack CS-5, Rack D',
        totalCopies: 5,
        availableCopies: 5,
        availability: true,
        description: 'Data preprocessing, data warehousing, OLAP, association rule mining (Apriori), classification algorithms, cluster analysis, and outlier detection.'
      },
      {
        bookId: 'BK-1030',
        title: 'Deep Learning',
        author: 'Ian Goodfellow, Yoshua Bengio, Aaron Courville',
        category: 'Artificial Intelligence',
        isbn: '978-0262035613',
        publisher: 'MIT Press',
        edition: '1st Edition',
        shelfLocation: 'Stack CS-5, Rack A',
        totalCopies: 4,
        availableCopies: 4,
        availability: true,
        description: 'Mathematical foundations, deep feedforward networks, regularization, optimization, convolutional networks (CNN), sequence modeling (RNN/LSTM), and GANs.'
      }
    ];

    const books = [];
    for (const b of bookData) {
      const bookDoc = await Book.create(b);
      books.push(bookDoc);
    }

    // 4. Generate Unique Physical Copies for each book (Mentor requirement)
    console.log('[Seed] Generating unique BookCopy records (e.g. BK-1001-C01, BK-1001-C02...)...');
    const allCopies = {};

    for (const book of books) {
      allCopies[book.bookId] = [];
      for (let i = 1; i <= book.totalCopies; i++) {
        const copyCode = `${book.bookId}-C${String(i).padStart(2, '0')}`;
        const copyDoc = await BookCopy.create({
          copyId: copyCode,
          bookId: book._id,
          copyNumber: i,
          status: 'AVAILABLE',
          shelfLocation: book.shelfLocation || 'Main Stack',
          conditionNotes: 'Good'
        });
        allCopies[book.bookId].push(copyDoc);
      }
    }

    // 5. Seed Circulations with Specific Physical Copies
    console.log('[Seed] Creating initial circulations linked to specific copies...');
    const now = new Date();

    // Assign copy 1 of Algorithms (BK-1001-C01) to studentPatron (Prince Kaushal)
    const copyAlgo1 = allCopies['BK-1001'][0];
    const circ1 = await Circulation.create({
      circulationId: 'CIRC-2026-001',
      userId: studentPatron._id,
      bookId: books[0]._id, // Algorithms
      copyId: copyAlgo1._id,
      copyCode: copyAlgo1.copyId,
      issueDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      status: 'ISSUED',
      fine: 0
    });
    copyAlgo1.status = 'ISSUED';
    copyAlgo1.currentCirculationId = circ1._id;
    await copyAlgo1.save();

    // Assign copy 1 of OS Concepts (BK-1002-C01) to studentPatron (Prince Kaushal) - Overdue
    const copyOs1 = allCopies['BK-1002'][0];
    const overdueDue = new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000);
    const circ2 = await Circulation.create({
      circulationId: 'CIRC-2026-002',
      userId: studentPatron._id,
      bookId: books[1]._id, // Operating Systems
      copyId: copyOs1._id,
      copyCode: copyOs1.copyId,
      issueDate: new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000),
      dueDate: overdueDue,
      status: 'OVERDUE',
      fine: 20 // 4 days * Rs 5
    });
    copyOs1.status = 'ISSUED';
    copyOs1.currentCirculationId = circ2._id;
    await copyOs1.save();

    // Mark AI copies (BK-1005) as currently checked out so available = 0
    const aiCopy1 = allCopies['BK-1005'][0];
    const aiCopy2 = allCopies['BK-1005'][1];
    aiCopy1.status = 'ISSUED';
    aiCopy2.status = 'ISSUED';
    await aiCopy1.save();
    await aiCopy2.save();

    // Past returned loan (BK-1003-C01) with fine paid
    const copyDb1 = allCopies['BK-1003'][0];
    const circ3 = await Circulation.create({
      circulationId: 'CIRC-2026-003',
      userId: facultyPatron._id,
      bookId: books[2]._id, // Databases
      copyId: copyDb1._id,
      copyCode: copyDb1.copyId,
      issueDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      dueDate: new Date(now.getTime() - 16 * 24 * 60 * 60 * 1000),
      returnDate: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000), // returned 2 days late
      fine: 10,
      status: 'RETURNED',
      remarks: 'Returned in good order'
    });
    // DB copy returned and available
    copyDb1.status = 'AVAILABLE';
    await copyDb1.save();

    // Sync available counts on Book models
    for (const book of books) {
      const availCount = await BookCopy.countDocuments({ bookId: book._id, status: 'AVAILABLE' });
      book.availableCopies = availCount;
      book.availability = availCount > 0;
      await book.save();
    }

    // 6. Seed Fines (FR-007)
    console.log('[Seed] Creating fine records...');
    await Fine.create({
      fineId: 'FINE-2026-001',
      circulationId: circ3._id,
      userId: facultyPatron._id,
      amount: 10,
      reason: 'Overdue Return: 2 day(s) late (Rate: Rs 5/day)',
      status: 'PAID',
      paidAt: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
      remarks: 'Payment received at circulation counter'
    });

    await Fine.create({
      fineId: 'FINE-2026-002',
      circulationId: circ2._id,
      userId: studentPatron._id,
      amount: 20,
      reason: `Overdue Loan on Copy ${copyOs1.copyId}: 4 day(s) late (Rate: Rs 5/day)`,
      status: 'PENDING',
      remarks: 'Pending student return at counter'
    });

    // 7. Seed Service Requests (FR-004, FR-005, FR-006)
    console.log('[Seed] Creating service requests...');
    await ServiceRequest.create({
      requestId: 'REQ-2026-001',
      userId: studentPatron._id,
      bookId: books[4]._id, // AI (0 copies available)
      type: 'RESERVATION',
      status: 'PENDING',
      details: 'Requesting reservation for semester project reference once a copy is returned.',
      submittedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000)
    });

    await ServiceRequest.create({
      requestId: 'REQ-2026-002',
      userId: studentPatron._id,
      circulationId: circ1._id,
      copyCode: copyAlgo1.copyId,
      type: 'RENEWAL',
      status: 'PENDING',
      details: `Need 14 more days with Copy ${copyAlgo1.copyId} to complete the dynamic programming assignments.`,
      submittedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000)
    });

    await ServiceRequest.create({
      requestId: 'REQ-2026-003',
      userId: studentPatron._id,
      bookId: books[1]._id,
      copyCode: copyOs1.copyId,
      type: 'COMPLAINT',
      status: 'APPROVED',
      details: `Pages 145-152 of Copy ${copyOs1.copyId} were slightly loose when borrowed. Informing staff so I am not penalized upon return.`,
      staffRemarks: 'Noted by staff. Binding damage recorded as pre-existing on copy record.',
      submittedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
    });

    await ServiceRequest.create({
      requestId: 'REQ-2026-004',
      userId: facultyPatron._id,
      type: 'SUGGESTION',
      suggestedTitle: 'Designing Data-Intensive Applications',
      suggestedAuthor: 'Martin Kleppmann',
      status: 'RESOLVED',
      details: 'Highly requested by MCA 3rd Sem distributed systems course.',
      staffRemarks: 'Approved for purchase in next semester budget allocation.',
      submittedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000),
      resolvedAt: new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000)
    });

    // 8. Seed Notifications (FR-008)
    console.log('[Seed] Creating notifications...');
    await Notification.create({
      notificationId: 'NOTIF-2026-001',
      userId: studentPatron._id,
      type: 'OVERDUE',
      title: 'Book Overdue Alert!',
      message: `The book "Operating System Concepts" (Copy ID: ${copyOs1.copyId}) is overdue since ${overdueDue.toLocaleDateString()}. Please return it to avoid additional daily fines.`,
      link: '/patron/my-books',
      status: 'UNREAD',
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
    });

    await Notification.create({
      notificationId: 'NOTIF-2026-002',
      userId: studentPatron._id,
      type: 'REQUEST_STATUS',
      title: 'Service Request Approved',
      message: `Your complaint regarding copy ${copyOs1.copyId} (REQ-2026-003) was reviewed and approved with staff remarks.`,
      link: '/patron/my-requests',
      status: 'READ',
      createdAt: new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000)
    });

    await Notification.create({
      notificationId: 'NOTIF-2026-003',
      userId: studentPatron._id,
      type: 'CIRCULATION',
      title: 'Book Issued Successfully',
      message: `Introduction to Algorithms (Copy ID: ${copyAlgo1.copyId}) has been issued to you. Due date: ${new Date(circ1.dueDate).toLocaleDateString()}`,
      link: '/patron/my-books',
      status: 'READ',
      createdAt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    });

    console.log('----------------------------------------------------');
    console.log('[Seed] DATABASE SEEDED SUCCESSFULLY WITH UNIQUE COPY IDs!');
    console.log('----------------------------------------------------');
    console.log('Example: "Introduction to Algorithms" has 10 physical copies:');
    console.log('  BK-1001-C01  -->  ISSUED to Prince Kaushal (student@amu.ac.in)');
    console.log('  BK-1001-C02 to BK-1001-C10  -->  AVAILABLE in library stack');
    console.log('----------------------------------------------------');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('[Seed Error]:', error);
    process.exit(1);
  }
};

seedData();
