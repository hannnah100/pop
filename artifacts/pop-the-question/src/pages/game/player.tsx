import { AnimatePresence, motion } from "framer-motion";

// ...existing imports and code...

// active question header

            <motion.h2
              key={q?.prompt ?? "loading"}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="font-question-pop font-black text-white text-xl uppercase leading-tight"
              style={{ textShadow: "2px 2px 0 #000" }}
            >
              {q?.prompt || "Loading…"}
            </motion.h2>
