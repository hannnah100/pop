import { AnimatePresence, motion } from "framer-motion";

// ...existing imports and code...

// inside renderPQ()

            <motion.h2
              key={`pq-${pqQuestion.roundIndex}-${pqQuestion.questionIndex}`}
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -50, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 180, damping: 22 }}
              className="font-question-pq font-black text-4xl md:text-6xl leading-tight uppercase text-center mb-10 text-black"
            >
              {pqQuestion.prompt}
            </motion.h2>
