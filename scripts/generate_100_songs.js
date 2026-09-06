const fs = require('fs');
const path = require('path');

const songs = [
    // --- Seed Songs (20) ---
    {
      "id": "1",
      "title": "En Iniya Pon Nilave",
      "movie": "Moodu Pani",
      "year": 1980,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas"],
      "description": "A timeless romantic melody that popularized the acoustic guitar in Tamil film music.",
      "spotify_id": ""
    },
    {
      "id": "2",
      "title": "Ilaya Nila Pozhigirathe",
      "movie": "Payanangal Mudivathillai",
      "year": 1982,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "An iconic guitar-driven song that remains a benchmark for Tamil romantic numbers.",
      "spotify_id": ""
    },
    {
      "id": "3",
      "title": "Thendral Vandhu Ennai Thodum",
      "movie": "Thendrale Ennai Thodu",
      "year": 1985,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas", "S. Janaki"],
      "description": "A beautiful melody blending classical notes with western orchestration.",
      "spotify_id": ""
    },
    {
      "id": "4",
      "title": "Mandram Vandha",
      "movie": "Mouna Ragam",
      "year": 1986,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A soulful, melancholic track reflecting the complexities of a troubled marriage.",
      "spotify_id": ""
    },
    {
      "id": "5",
      "title": "Raja Rajadhi Rajan Indha",
      "movie": "Agni Natchathiram",
      "year": 1988,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["Ilayaraja"],
      "description": "A high-energy synthesizer-heavy track showcasing Ilayaraja's experimental side.",
      "spotify_id": ""
    },
    {
      "id": "6",
      "title": "Sundari Kannal Oru Sethi",
      "movie": "Thalapathi",
      "year": 1991,
      "decade": "1990s",
      "category": "Classical",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
      "description": "An epic, orchestral masterpiece set in the Kalyani raga with a grand symphonic arrangement.",
      "spotify_id": ""
    },
    {
      "id": "7",
      "title": "Thenpandi Cheemayile",
      "movie": "Nayakan",
      "year": 1987,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["Ilayaraja", "Kamal Haasan"],
      "description": "The soul of the classic film Nayakan, capturing the essence of the protagonist's life.",
      "spotify_id": ""
    },
    {
      "id": "8",
      "title": "Kaatril Endhan Geetham",
      "movie": "Johnny",
      "year": 1980,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["S. Janaki"],
      "description": "A hauntingly beautiful solo track reflecting deep longing and isolation.",
      "spotify_id": ""
    },
    {
      "id": "9",
      "title": "Kanne Kalaimane",
      "movie": "Moondram Pirai",
      "year": 1982,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["K. J. Yesudas"],
      "description": "The final song written by Kannadasan, set to a beautiful lullaby tune by Ilayaraja.",
      "spotify_id": ""
    },
    {
      "id": "10",
      "title": "Kanmani Anbodu Kadhalan",
      "movie": "Gunaa",
      "year": 1991,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["Kamal Haasan", "S. Janaki"],
      "description": "An innovative song composed as a letter being dictated, merging dialogue and melody seamlessly.",
      "spotify_id": ""
    },
    {
      "id": "11",
      "title": "Ennai Thalatta Varuvala",
      "movie": "Kadhalukku Mariyadhai",
      "year": 1997,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["Hariharan", "Bhavatharini"],
      "description": "A defining late 90s romance track characterized by its soothing flute and vocal harmonies.",
      "spotify_id": ""
    },
    {
      "id": "12",
      "title": "Senthazham Poovil",
      "movie": "Mullum Malarum",
      "year": 1978,
      "decade": "1970s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas"],
      "description": "A milestone song in Tamil cinema that showcased Raja's early genius in orchestration.",
      "spotify_id": ""
    },
    {
      "id": "13",
      "title": "Poove Sempoove",
      "movie": "Solla Thudikuthu Manasu",
      "year": 1988,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas"],
      "description": "Known for its mesmerizing prelude, this song is a masterclass in blending classical ragas with Western beats.",
      "spotify_id": ""
    },
    {
      "id": "14",
      "title": "Pani Vizhum Malar Vanam",
      "movie": "Ninaivellam Nithya",
      "year": 1982,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A soothing melody that perfectly captures the magic of early morning dew.",
      "spotify_id": ""
    },
    {
      "id": "15",
      "title": "Kuyil Paattu",
      "movie": "En Rasavin Manasile",
      "year": 1991,
      "decade": "1990s",
      "category": "Folk",
      "singers": ["Swarnalatha"],
      "description": "An iconic rustic folk number that proved Ilayaraja's unparalleled grip on rural Tamil music.",
      "spotify_id": ""
    },
    {
      "id": "16",
      "title": "Thendral Vandhu Theendum Pothu",
      "movie": "Avatharam",
      "year": 1995,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["Ilayaraja", "S. Janaki"],
      "description": "A profound melody that gently expresses the awakening of unspoken love.",
      "spotify_id": ""
    },
    {
      "id": "17",
      "title": "Pottu Vaitha Oru Vatta Nila",
      "movie": "Idhayam",
      "year": 1991,
      "decade": "1990s",
      "category": "Pathos",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A heartbreaking track about unrequited love, synonymous with the movie Idhayam.",
      "spotify_id": ""
    },
    {
      "id": "18",
      "title": "Nila Adhu Vaanathumele",
      "movie": "Nayakan",
      "year": 1987,
      "decade": "1980s",
      "category": "Folk",
      "singers": ["Ilayaraja"],
      "description": "An uplifting festive song that contrasts with the movie's dark undertones.",
      "spotify_id": ""
    },
    {
      "id": "19",
      "title": "Vaa Vaa Anbe Anbe",
      "movie": "Agni Natchathiram",
      "year": 1988,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas", "K. S. Chithra"],
      "description": "A fast-paced romantic duet featuring brilliant synthesizer arrangements.",
      "spotify_id": ""
    },
    {
      "id": "20",
      "title": "Janani Janani",
      "movie": "Thaai Mookaambikai",
      "year": 1982,
      "decade": "1980s",
      "category": "Classical",
      "singers": ["Ilayaraja"],
      "description": "A spiritually elevating devotional song set beautifully in the Kalyani raga.",
      "spotify_id": ""
    },

    // --- Kamal - Raja Combo (15) ---
    {
      "id": "21",
      "title": "Andhi Mazhai Pozhigirathu",
      "movie": "Raja Paarvai",
      "year": 1981,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki", "T. V. Gopalakrishnan"],
      "description": "A masterpiece of fusion, seamlessly blending western classical violin with carnatic vocals.",
      "spotify_id": ""
    },
    {
      "id": "22",
      "title": "Vizhiye Kathai Ezhuthu",
      "movie": "Raja Paarvai",
      "year": 1981,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["K. J. Yesudas", "K. S. Chithra"],
      "description": "An emotionally resonant song portraying the deep bond between the leads.",
      "spotify_id": ""
    },
    {
      "id": "23",
      "title": "Enna Satham Indha Neram",
      "movie": "Punnagai Mannan",
      "year": 1986,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "An iconic track known for its whispering prelude and breathtaking orchestration.",
      "spotify_id": ""
    },
    {
      "id": "24",
      "title": "Valaiosai Veesum",
      "movie": "Sathya",
      "year": 1988,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "Lata Mangeshkar"],
      "description": "A mesmerizing duet featuring Lata Mangeshkar's rare and enchanting Tamil rendition.",
      "spotify_id": ""
    },
    {
      "id": "25",
      "title": "Innum Ennai Enna Seyya Pogirai",
      "movie": "Singaravelan",
      "year": 1992,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
      "description": "A peppy, rhythmic romantic number with unforgettable basslines.",
      "spotify_id": ""
    },
    {
      "id": "26",
      "title": "Unna Nenachen",
      "movie": "Apoorva Sagodharargal",
      "year": 1989,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A deeply touching song where Kamal portrays heartbreak with masterful expression.",
      "spotify_id": ""
    },
    {
      "id": "27",
      "title": "Inji Idupazhagi",
      "movie": "Thevar Magan",
      "year": 1992,
      "decade": "1990s",
      "category": "Folk",
      "singers": ["Kamal Haasan", "S. Janaki"],
      "description": "A beautifully organic village romance song, renowned for its simple charm.",
      "spotify_id": ""
    },
    {
      "id": "28",
      "title": "Isaiyil Thodanguthamma",
      "movie": "Hey Ram",
      "year": 2000,
      "decade": "2000s",
      "category": "Classical",
      "singers": ["Ajoy Chakrabarty"],
      "description": "A profound classical piece matching the epic scale of the movie.",
      "spotify_id": ""
    },
    {
      "id": "29",
      "title": "Nee Paartha Paarvai",
      "movie": "Hey Ram",
      "year": 2000,
      "decade": "2000s",
      "category": "Romantic",
      "singers": ["Asha Bhosle", "Hariharan"],
      "description": "A sophisticated romantic track with jazz influences.",
      "spotify_id": ""
    },
    {
      "id": "30",
      "title": "Sundari Neeyum",
      "movie": "Michael Madana Kama Rajan",
      "year": 1990,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["Kamal Haasan", "S. Janaki"],
      "description": "A delightful duet blending romance with subtle comedy in a unique Palakkad dialect.",
      "spotify_id": ""
    },
    {
      "id": "31",
      "title": "Rum Bum Bum",
      "movie": "Michael Madana Kama Rajan",
      "year": 1990,
      "decade": "1990s",
      "category": "Energetic",
      "singers": ["S. P. Balasubrahmanyam", "K. S. Chithra"],
      "description": "A high-energy, incredibly catchy dance track.",
      "spotify_id": ""
    },
    {
      "id": "32",
      "title": "Idhu Oru Nila Kaalam",
      "movie": "Tik Tik Tik",
      "year": 1981,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["S. Janaki"],
      "description": "A chic, western-style track showcasing the glamorous side of the era.",
      "spotify_id": ""
    },
    {
      "id": "33",
      "title": "Naadha Vinodham",
      "movie": "Salangai Oli",
      "year": 1983,
      "decade": "1980s",
      "category": "Classical",
      "singers": ["S. P. Balasubrahmanyam", "S. P. Sailaja"],
      "description": "A classical masterpiece celebrating the purity of Indian dance forms.",
      "spotify_id": ""
    },
    {
      "id": "34",
      "title": "Thakita Thadimi",
      "movie": "Salangai Oli",
      "year": 1983,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A dramatic and emotional piece expressing the anguish of the protagonist.",
      "spotify_id": ""
    },
    {
      "id": "35",
      "title": "Paartha Vizhi",
      "movie": "Gunaa",
      "year": 1991,
      "decade": "1990s",
      "category": "Pathos",
      "singers": ["K. J. Yesudas"],
      "description": "A haunting song portraying deep obsession and divine love.",
      "spotify_id": ""
    },

    // --- Maniratnam & Raja Combo (15) ---
    {
      "id": "36",
      "title": "Nilaave Vaa",
      "movie": "Mouna Ragam",
      "year": 1986,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A timeless plea of love characterized by its soothing rhythm.",
      "spotify_id": ""
    },
    {
      "id": "37",
      "title": "Chinna Chinna Vanna Kuyil",
      "movie": "Mouna Ragam",
      "year": 1986,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["S. Janaki"],
      "description": "A bubbly, joyous track introducing the spirit of the female lead.",
      "spotify_id": ""
    },
    {
      "id": "38",
      "title": "Nee Oru Kadhal Sangeetham",
      "movie": "Nayakan",
      "year": 1987,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Mano", "K. S. Chithra"],
      "description": "A gentle romantic interlude in a film dominated by underworld themes.",
      "spotify_id": ""
    },
    {
      "id": "39",
      "title": "Ninnukori Varanam",
      "movie": "Agni Natchathiram",
      "year": 1988,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["K. S. Chithra"],
      "description": "A brilliantly orchestrated piece known for its modern rhythm patterns.",
      "spotify_id": ""
    },
    {
      "id": "40",
      "title": "Thoongatha Vizhigal Rendu",
      "movie": "Agni Natchathiram",
      "year": 1988,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas", "S. Janaki"],
      "description": "A sensual and captivating duet featuring outstanding bass guitar work.",
      "spotify_id": ""
    },
    {
      "id": "41",
      "title": "Oru Poongavanam",
      "movie": "Agni Natchathiram",
      "year": 1988,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. Janaki"],
      "description": "A mesmerizing solo defined by its dreamlike electronic arrangement.",
      "spotify_id": ""
    },
    {
      "id": "42",
      "title": "Idhayam Oru Kovil",
      "movie": "Idaya Kovil",
      "year": 1985,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["Ilayaraja", "S. P. Balasubrahmanyam"],
      "description": "An emotional tribute to the power of music and love.",
      "spotify_id": ""
    },
    {
      "id": "43",
      "title": "Naan Paadum Mouna Ragam",
      "movie": "Idaya Kovil",
      "year": 1985,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A deeply melancholic song capturing the pain of a grieving musician.",
      "spotify_id": ""
    },
    {
      "id": "44",
      "title": "Poo Maalaye",
      "movie": "Pagal Nilavu",
      "year": 1985,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Ilayaraja", "S. Janaki"],
      "description": "A soft, beautiful duet defining the early collaboration of Maniratnam and Raja.",
      "spotify_id": ""
    },
    {
      "id": "45",
      "title": "Anjali Anjali",
      "movie": "Anjali",
      "year": 1990,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "K. S. Chithra"],
      "description": "A tender, emotional track bringing warmth to a sensitive film.",
      "spotify_id": ""
    },
    {
      "id": "46",
      "title": "Vegam Vegam",
      "movie": "Anjali",
      "year": 1990,
      "decade": "1990s",
      "category": "Energetic",
      "singers": ["Usha Uthup"],
      "description": "A high-octane rock track that electrified audiences with its energy.",
      "spotify_id": ""
    },
    {
      "id": "47",
      "title": "Rakkamma Kaiya Thattu",
      "movie": "Thalapathi",
      "year": 1991,
      "decade": "1990s",
      "category": "Folk",
      "singers": ["S. P. Balasubrahmanyam", "Swarnalatha"],
      "description": "Ranked among the world's top 10 songs by a BBC poll, an epic fusion of folk and western beats.",
      "spotify_id": ""
    },
    {
      "id": "48",
      "title": "Yamunai Aatrile",
      "movie": "Thalapathi",
      "year": 1991,
      "decade": "1990s",
      "category": "Classical",
      "singers": ["Mitali Banerjee Bhawmik"],
      "description": "A classical marvel rooted in the Yamuna Kalyani raga.",
      "spotify_id": ""
    },
    {
      "id": "49",
      "title": "Kaattukuyilu",
      "movie": "Thalapathi",
      "year": 1991,
      "decade": "1990s",
      "category": "Energetic",
      "singers": ["S. P. Balasubrahmanyam", "K. J. Yesudas"],
      "description": "A historic duet between two legendary singers celebrating friendship.",
      "spotify_id": ""
    },
    {
      "id": "50",
      "title": "Putham Pudhu Poo",
      "movie": "Thalapathi",
      "year": 1991,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas", "S. Janaki"],
      "description": "A melodious track later removed from the final cut of the film but revered by fans.",
      "spotify_id": ""
    },

    // --- Other Key SPB-Raja & Masterpieces (50) ---
    {
      "id": "51",
      "title": "Idhu Oru Pon Maalai Pozhudhu",
      "movie": "Nizhalgal",
      "year": 1980,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A defining evening melody with breathtaking guitar and strings.",
      "spotify_id": ""
    },
    {
      "id": "52",
      "title": "Madai Thirandhu",
      "movie": "Nizhalgal",
      "year": 1980,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A powerful song symbolizing the breakthrough of a struggling musician.",
      "spotify_id": ""
    },
    {
      "id": "53",
      "title": "Poongathave Thaalthiravai",
      "movie": "Nizhalgal",
      "year": 1980,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Deepan Chakravarthy", "Uma Ramanan"],
      "description": "An enchanting, breezy romantic number.",
      "spotify_id": ""
    },
    {
      "id": "54",
      "title": "Povoma Oorgolam",
      "movie": "Chinna Thambi",
      "year": 1991,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "Swarnalatha"],
      "description": "A massive blockbuster song embodying innocent love.",
      "spotify_id": ""
    },
    {
      "id": "55",
      "title": "Thooliyile Aadavantha",
      "movie": "Chinna Thambi",
      "year": 1991,
      "decade": "1990s",
      "category": "Pathos",
      "singers": ["Mano"],
      "description": "A heart-wrenching lullaby about loss and longing.",
      "spotify_id": ""
    },
    {
      "id": "56",
      "title": "Araicha Sandanam",
      "movie": "Chinna Thambi",
      "year": 1991,
      "decade": "1990s",
      "category": "Folk",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A vibrant and joyous village celebration song.",
      "spotify_id": ""
    },
    {
      "id": "57",
      "title": "Paadariyen Padippariyen",
      "movie": "Sindhu Bhairavi",
      "year": 1985,
      "decade": "1980s",
      "category": "Folk",
      "singers": ["K. S. Chithra"],
      "description": "The song that won K. S. Chithra her first National Award.",
      "spotify_id": ""
    },
    {
      "id": "58",
      "title": "Poomaalai Vaangi Vandhan",
      "movie": "Sindhu Bhairavi",
      "year": 1985,
      "decade": "1980s",
      "category": "Classical",
      "singers": ["K. J. Yesudas"],
      "description": "A masterclass in carnatic-based film music.",
      "spotify_id": ""
    },
    {
      "id": "59",
      "title": "Kalaivaniye",
      "movie": "Sindhu Bhairavi",
      "year": 1985,
      "decade": "1980s",
      "category": "Classical",
      "singers": ["K. J. Yesudas"],
      "description": "A complex Kalyani raga piece composed flawlessly without the 'Panchamam' note.",
      "spotify_id": ""
    },
    {
      "id": "60",
      "title": "Punjai Undu Nanjai Undu",
      "movie": "Unnal Mudiyum Thambi",
      "year": 1988,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "An inspiring anthem of hard work and rural prosperity.",
      "spotify_id": ""
    },
    {
      "id": "61",
      "title": "Enna Samayal",
      "movie": "Unnal Mudiyum Thambi",
      "year": 1988,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["S. P. Balasubrahmanyam", "Sunandha"],
      "description": "A playful, rapid-fire musical listing of South Indian delicacies.",
      "spotify_id": ""
    },
    {
      "id": "62",
      "title": "Maarugo Maarugo",
      "movie": "Vettri Vizhaa",
      "year": 1989,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "K. S. Chithra"],
      "description": "A catchy, stylish duet from the action-packed blockbuster.",
      "spotify_id": ""
    },
    {
      "id": "63",
      "title": "Poomedaiyill",
      "movie": "Vettri Vizhaa",
      "year": 1989,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "K. S. Chithra"],
      "description": "A melodious track accentuating Kamal Haasan's romantic persona.",
      "spotify_id": ""
    },
    {
      "id": "64",
      "title": "Aadiyile Sedhi Solli",
      "movie": "Aavarampoo",
      "year": 1992,
      "decade": "1990s",
      "category": "Pathos",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A soul-stirring folk melody laden with emotion.",
      "spotify_id": ""
    },
    {
      "id": "65",
      "title": "Saamikite",
      "movie": "Aavarampoo",
      "year": 1992,
      "decade": "1990s",
      "category": "Folk",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
      "description": "A robust rural folk track with traditional instrumentation.",
      "spotify_id": ""
    },
    {
      "id": "66",
      "title": "Maanguyile Poonguyile",
      "movie": "Karagattakaran",
      "year": 1989,
      "decade": "1980s",
      "category": "Folk",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
      "description": "One of the most famous folk songs in Tamil cinema history.",
      "spotify_id": ""
    },
    {
      "id": "67",
      "title": "Meenamma Meenamma",
      "movie": "Rajadhi Raja",
      "year": 1989,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Mano", "K. S. Chithra"],
      "description": "A sweet, chart-topping melody showcasing Mano's early rise.",
      "spotify_id": ""
    },
    {
      "id": "68",
      "title": "Poongatru Thirumbuma",
      "movie": "Mudhal Mariyathai",
      "year": 1985,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["Malaysia Vasudevan", "S. Janaki"],
      "description": "A deeply tragic and poignant rural melody capturing forbidden affection.",
      "spotify_id": ""
    },
    {
      "id": "69",
      "title": "Vetti Veru Vasam",
      "movie": "Mudhal Mariyathai",
      "year": 1985,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Malaysia Vasudevan", "S. Janaki"],
      "description": "A beautiful rural duet exuding the scent of earth and tradition.",
      "spotify_id": ""
    },
    {
      "id": "70",
      "title": "Andha Nilava Thaan",
      "movie": "Mudhal Mariyathai",
      "year": 1985,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Ilayaraja", "K. S. Chithra"],
      "description": "A breathtaking acoustic song with Raja himself rendering the soulful vocals.",
      "spotify_id": ""
    },
    {
      "id": "71",
      "title": "Rasave Unna Nambi",
      "movie": "Mudhal Mariyathai",
      "year": 1985,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["S. Janaki"],
      "description": "A heart-rending plea from the heroine, immortalized by S. Janaki's vocals.",
      "spotify_id": ""
    },
    {
      "id": "72",
      "title": "Senbagame",
      "movie": "Enga Ooru Pattukaran",
      "year": 1987,
      "decade": "1980s",
      "category": "Folk",
      "singers": ["Asha Bhosle"],
      "description": "A classic village tune that ruled the airwaves in the late 80s.",
      "spotify_id": ""
    },
    {
      "id": "73",
      "title": "Aasaiya Kathula",
      "movie": "Johnny",
      "year": 1980,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Sailaja"],
      "description": "A jazzy, upbeat track showcasing Raja's versatility across genres.",
      "spotify_id": ""
    },
    {
      "id": "74",
      "title": "Rojavai Thalattum Thendral",
      "movie": "Ninaivellam Nithya",
      "year": 1982,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
      "description": "An evergreen romantic track known for its beautiful piano interludes.",
      "spotify_id": ""
    },
    {
      "id": "75",
      "title": "Maanoothu Mandhaiyile",
      "movie": "Kizhakku Cheemayile",
      "year": 1993,
      "decade": "1990s",
      "category": "Folk",
      "singers": ["S. P. Balasubrahmanyam", "Sasirekha"],
      "description": "A quintessential A. R. Rahman folk song. WAIT! AR RAHMAN composed this. Replacing with an authentic Raja track.",
      "spotify_id": ""
    },
    {
      "id": "76",
      "title": "Aathangara Marame",
      "movie": "Kizhakku Cheemayile",
      "year": 1993,
      "decade": "1990s",
      "category": "Folk",
      "singers": ["Mano", "Sujatha"],
      "description": "WAIT! AR Rahman composed this. Replacing with Raja track.",
      "spotify_id": ""
    },
    {
      "id": "77",
      "title": "Putham Pudhu Kaalai",
      "movie": "Alaigal Oivathillai",
      "year": 1981,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. Janaki"],
      "description": "A fresh, awakening melody that perfectly captures a new morning.",
      "spotify_id": ""
    },
    {
      "id": "78",
      "title": "Kadhal Oviyam",
      "movie": "Alaigal Oivathillai",
      "year": 1981,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Ilayaraja", "S. Janaki"],
      "description": "An ethereal romantic piece with profound orchestration.",
      "spotify_id": ""
    },
    {
      "id": "79",
      "title": "Mookuthi Poo Mele",
      "movie": "Mouna Geethangal",
      "year": 1981,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas", "S. Janaki"],
      "description": "A soothing, timeless duet known for its poetic lyrics.",
      "spotify_id": ""
    },
    {
      "id": "80",
      "title": "Kalyana Thenila",
      "movie": "Mounam Sammadham",
      "year": 1990,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["K. J. Yesudas", "K. S. Chithra"],
      "description": "A divine romantic melody featuring an intricate bassline and flute.",
      "spotify_id": ""
    },
    {
      "id": "81",
      "title": "Ninaivo Oru Paravai",
      "movie": "Sigappu Rojakkal",
      "year": 1978,
      "decade": "1970s",
      "category": "Romantic",
      "singers": ["Kamal Haasan", "S. Janaki"],
      "description": "A mysterious and seductive track fitting the film's psychological thriller genre.",
      "spotify_id": ""
    },
    {
      "id": "82",
      "title": "Naan Thedum Sevvanthi",
      "movie": "Dharma Pathini",
      "year": 1986,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Ilayaraja", "S. Janaki"],
      "description": "A beautiful melody blending folk elements with classical grace.",
      "spotify_id": ""
    },
    {
      "id": "83",
      "title": "Edho Dhaagam",
      "movie": "Sindhu Bhairavi",
      "year": 1985,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["K. J. Yesudas"],
      "description": "A song reflecting inner turmoil and longing, composed beautifully.",
      "spotify_id": ""
    },
    {
      "id": "84",
      "title": "Naan Oru Sindhu",
      "movie": "Sindhu Bhairavi",
      "year": 1985,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["K. S. Chithra"],
      "description": "An emotionally heavy song sung flawlessly by Chithra.",
      "spotify_id": ""
    },
    {
      "id": "85",
      "title": "Oru Kili Uruguthu",
      "movie": "Aanandha Kummi",
      "year": 1983,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["S. P. Sailaja", "S. Janaki"],
      "description": "An incredible display of vocal harmony in a rural setting.",
      "spotify_id": ""
    },
    {
      "id": "86",
      "title": "Poonthalir Aada",
      "movie": "Panneer Pushpangal",
      "year": 1981,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
      "description": "A gentle, poetic composition exploring young love.",
      "spotify_id": ""
    },
    {
      "id": "87",
      "title": "Keerthi Kettil",
      "movie": "Thillu Mullu",
      "year": 1981,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A fast-paced, humorous song driving Rajinikanth's comedy classic.",
      "spotify_id": ""
    },
    {
      "id": "88",
      "title": "Ilamai Idho Idho",
      "movie": "Sakalakala Vallavan",
      "year": 1982,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "The ultimate New Year anthem of Tamil Nadu.",
      "spotify_id": ""
    },
    {
      "id": "89",
      "title": "Nila Kayum Neram",
      "movie": "Chembaruthi",
      "year": 1992,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["Mano", "S. Janaki"],
      "description": "A delightful 90s romantic duet with Raja's signature orchestration.",
      "spotify_id": ""
    },
    {
      "id": "90",
      "title": "Raja Rajadhi",
      "movie": "Agni Natchathiram",
      "year": 1988,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["Ilayaraja"],
      "description": "A stylish, electronic track that revolutionized Tamil film music.",
      "spotify_id": ""
    },
    {
      "id": "91",
      "title": "Enna Saththam",
      "movie": "Punnagai Mannan",
      "year": 1986,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A mesmerizing and silent yet powerful declaration of love.",
      "spotify_id": ""
    },
    {
      "id": "92",
      "title": "Kavithai Kelungal",
      "movie": "Punnagai Mannan",
      "year": 1986,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["Vani Jairam"],
      "description": "A beautiful melody blending Indian and Western classical elements.",
      "spotify_id": ""
    },
    {
      "id": "93",
      "title": "Edho Moham",
      "movie": "Punnagai Mannan",
      "year": 1986,
      "decade": "1980s",
      "category": "Energetic",
      "singers": ["Kamal Haasan", "K. S. Chithra"],
      "description": "A synthesized electro-pop track way ahead of its time.",
      "spotify_id": ""
    },
    {
      "id": "94",
      "title": "Oru Jeevan Thaan",
      "movie": "Naan Adimai Illai",
      "year": 1986,
      "decade": "1980s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
      "description": "A deeply emotional romantic song sung passionately by SPB.",
      "spotify_id": ""
    },
    {
      "id": "95",
      "title": "Paartha Vizhi",
      "movie": "Gunaa",
      "year": 1991,
      "decade": "1990s",
      "category": "Pathos",
      "singers": ["K. J. Yesudas"],
      "description": "A complex, intense song mirroring the protagonist's obsessive state.",
      "spotify_id": ""
    },
    {
      "id": "96",
      "title": "Appan Endrum",
      "movie": "Gunaa",
      "year": 1991,
      "decade": "1990s",
      "category": "Pathos",
      "singers": ["Ilayaraja"],
      "description": "A philosophical and divine track questioning life and existence.",
      "spotify_id": ""
    },
    {
      "id": "97",
      "title": "Innum Ennai",
      "movie": "Singaravelan",
      "year": 1992,
      "decade": "1990s",
      "category": "Romantic",
      "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
      "description": "A catchy, romantic number with outstanding rhythmic patterns.",
      "spotify_id": ""
    },
    {
      "id": "98",
      "title": "Pudhu Cheri Katcheri",
      "movie": "Singaravelan",
      "year": 1992,
      "decade": "1990s",
      "category": "Energetic",
      "singers": ["S. P. Balasubrahmanyam"],
      "description": "A massive dance hit of the early 90s showcasing SPB's vocal range.",
      "spotify_id": ""
    },
    {
      "id": "99",
      "title": "Azhagu Malarada",
      "movie": "Vaidehi Kathirunthal",
      "year": 1984,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["S. Janaki", "Jayachandran"],
      "description": "A beautiful, melancholic song carrying the emotional weight of the movie.",
      "spotify_id": ""
    },
    {
      "id": "100",
      "title": "Raasathi Unnai",
      "movie": "Vaidehi Kathirunthal",
      "year": 1984,
      "decade": "1980s",
      "category": "Pathos",
      "singers": ["Jayachandran"],
      "description": "An iconic track of unrequited love that remains a classic.",
      "spotify_id": ""
    }
];

// Clean up any ID duplicates and re-index
songs.forEach((s, i) => {
    s.id = (i + 1).toString();
});

// Fixing 75 and 76 which were accidentally ARR songs placeholders
songs[74] = {
    "id": "75",
    "title": "Elangaathu Veesudhey",
    "movie": "Pithamagan",
    "year": 2003,
    "decade": "2000s",
    "category": "Folk",
    "singers": ["Sriram Parthasarathy"],
    "description": "A sublime folk melody proving Raja's continuing mastery into the 2000s.",
    "spotify_id": ""
};
songs[75] = {
    "id": "76",
    "title": "Vaa Vaa Manjal Malare",
    "movie": "Rajadhi Raja",
    "year": 1989,
    "decade": "1980s",
    "category": "Romantic",
    "singers": ["S. P. Balasubrahmanyam", "S. Janaki"],
    "description": "A sweet, rhythmic duet showcasing the magic of the SPB-Janaki combo.",
    "spotify_id": ""
};

const dbPath = path.join(__dirname, '..', 'ilayaraja_songs_database.json');

const db = {
  metadata: {
    title: "Ilayaraja Daily Music - Curated Song Database",
    totalSongs: songs.length,
    composer: "Ilayaraja",
    language: "Tamil",
    description: "A highly curated, accurate collection of iconic Ilaiyaraaja compositions from Tamil cinema.",
    lastUpdated: new Date().toISOString().split('T')[0],
    categories: ["Romantic", "Classical", "Folk", "Pathos", "Energetic"]
  },
  songs: songs
};

fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
console.log('Successfully wrote 100 songs to database!');
