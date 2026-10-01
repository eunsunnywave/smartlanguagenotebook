"use client";

import { useEffect, useRef, useState } from "react";
import { pinyin } from "pinyin-pro";
import { supabase } from "@/lib/supabase";

type SavedWord = {
  id: string;
  language: string;
  text: string;
  pinyinText: string;
  meaning: string;
  category: string;
  created_at?: string;
};

type WordComment = {
  id: string;
  word_id: string;
  user_id?: string | null;
  comment: string;
  created_at?: string;
};

const meaningDictionary: Record<string, string> = {
  안녕: "Hello / Hi",
  안녕하세요: "Hello",
  감사합니다: "Thank you",
  고마워: "Thank you",
  미안해: "Sorry",
  죄송합니다: "I'm sorry",
  대박: "Amazing / Awesome",
  맛있다: "Delicious",
  좋아: "Good / I like it",
  좋아요: "Good / I like it",
  싫어: "I don't like it",
  예쁘다: "Pretty",
  멋있다: "Cool",
  괜찮아: "It's okay",
  뭐해: "What are you doing?",

  你好: "안녕하세요",
  谢谢: "감사합니다",
  再见: "안녕히 가세요 / 잘 가",
  对不起: "미안합니다",
  没关系: "괜찮아요",
  好吃: "맛있어요",
  好: "좋아요 / 좋아",
  不好: "좋지 않아요",
  大家: "여러분",
  朋友: "친구",
  老师: "선생님",
  学生: "학생",
  多少钱: "얼마예요?",
  我爱你: "사랑해",
  喜欢: "좋아하다",
  不喜欢: "좋아하지 않다",
};

const categories = [
  "일상회화",
  "여행",
  "회사",
  "음식",
  "기타",
];

export default function Home() {
  
  const [language, setLanguage] = useState("한국어");
  const [text, setText] = useState("");
  const [pinyinText, setPinyinText] = useState("");
  const [meaning, setMeaning] = useState("");
  const [category, setCategory] = useState("일상회화");

  const [savedWords, setSavedWords] = useState<SavedWord[]>([]);
  const [wordComments, setWordComments] = useState<WordComment[]>([]);
  const [user, setUser] = useState<any>(null);

  const isAdmin =
    user?.app_metadata?.role === "admin" ||
    user?.user_metadata?.role === "admin";

  const [hiddenCommentIds, setHiddenCommentIds] =
    useState<string[]>([]);

  const [newCommentText, setNewCommentText] =
    useState<Record<string, string>>({});

  const [commentLoadingId, setCommentLoadingId] =
    useState<string | null>(null);

  const [editingCommentKey, setEditingCommentKey] =
    useState<string | null>(null);

  const [editCommentText, setEditCommentText] =
    useState("");

  const [isListening, setIsListening] = useState(false);

  const [isAuthMode, setIsAuthMode] =
    useState<"login" | "signup">("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [errorMessage, setErrorMessage] = useState("");
  const [authMessage, setAuthMessage] = useState("");

  const [saveLoading, setSaveLoading] = useState(false);
  const [wordsLoading, setWordsLoading] = useState(false);

  const [selectedCategory, setSelectedCategory] =
    useState("전체");

  const [isAutoPlaying, setIsAutoPlaying] =
    useState(false);

  const [playingWordId, setPlayingWordId] =
    useState<string | null>(null);

  
  const [editingWordId, setEditingWordId] =
    useState<string | null>(null);
  
  
  const [editText, setEditText] = useState("");
  const [editPinyinText, setEditPinyinText] =
    useState("");
  const [editMeaning, setEditMeaning] =
    useState("");
  const [editCategory, setEditCategory] =
    useState("일상회화");

  const [editLoading, setEditLoading] =
    useState(false);

  // =========================
  // 번역 관련 상태
  // =========================
  const [translationLoading, setTranslationLoading] =
    useState(false);

  const [editTranslationLoading, setEditTranslationLoading] =
    useState(false);

 const [visibleMeaningIds, setVisibleMeaningIds] =
  useState<string[]>([]);

  const translationRequestRef = useRef(0);
  const editTranslationRequestRef = useRef(0);

  const autoPlayingRef = useRef(false);

  // =========================
  // 무료 번역 API
  // 중국어 → 한국어
  // 한국어 → 영어
  // =========================
  const translateText = async (
    value: string,
    sourceLanguage: string
  ): Promise<string> => {
    const trimmedValue = value.trim();

    if (!trimmedValue) {
      return "";
    }

    // 먼저 직접 등록된 사전 확인
    if (meaningDictionary[trimmedValue]) {
      return meaningDictionary[trimmedValue];
    }

    let langPair = "";

    if (sourceLanguage === "中文") {
      langPair = "zh-CN|ko";
    } else {
      langPair = "ko|en";
    }

    try {
      const url =
        `https://api.mymemory.translated.net/get?q=` +
        `${encodeURIComponent(trimmedValue)}` +
        `&langpair=${encodeURIComponent(langPair)}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(
          `번역 API 오류: ${response.status}`
        );
      }

      const data = await response.json();

      const translatedText =
        data?.responseData?.translatedText;

      if (
        typeof translatedText === "string" &&
        translatedText.trim()
      ) {
        return translatedText.trim();
      }

      return "";
    } catch (error) {
      console.error(
        "무료 번역 API 오류:",
        error
      );

      return "";
    }
  };

  // =========================
  // 입력 단어 자동 번역
  // =========================
  useEffect(() => {
    const trimmedText = text.trim();

    if (!trimmedText) {
      setMeaning("");
      return;
    }

    const dictionaryMeaning =
      meaningDictionary[trimmedText];

    if (dictionaryMeaning) {
      setMeaning(dictionaryMeaning);
      return;
    }

    const requestId =
      ++translationRequestRef.current;

    const timer = window.setTimeout(
      async () => {
        setTranslationLoading(true);

        const translated =
          await translateText(
            trimmedText,
            language
          );

        if (
          requestId !==
          translationRequestRef.current
        ) {
          return;
        }

        if (translated) {
          setMeaning(translated);
        } else {
          setMeaning(
            "번역 결과를 찾을 수 없습니다."
          );
        }

        setTranslationLoading(false);
      },
      700
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [text, language]);

  // =========================
  // 로그인 사용자 확인
  // =========================
  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);

      if (user) {
        await loadWords(user.id);
      }
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const currentUser =
          session?.user ?? null;

        setUser(currentUser);

        if (currentUser) {
          await loadWords(currentUser.id);
        } else {
          setSavedWords([]);
          setWordComments([]);
        }
      }
    );

    return () => {
      subscription.unsubscribe();

      autoPlayingRef.current = false;

      window.speechSynthesis.cancel();
    };
  }, []);

  // =========================
  // 단어 불러오기
  // =========================
  const loadWords = async (userId: string) => {
    setWordsLoading(true);
    setErrorMessage("");

    const { data, error } = await supabase
      .from("words")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", {
        ascending: false,
      });

    if (error) {
      console.error(
        "단어 불러오기 오류:",
        error
      );

      setErrorMessage(
        "저장된 단어를 불러오지 못했습니다."
      );

      setWordsLoading(false);
      return;
    }

    const formattedWords: SavedWord[] =
      (data || []).map((word: any) => ({
        id: word.id,
        language: word.language,
        text: word.text,
        pinyinText:
          word.pinyin_text || "",
        meaning: word.meaning || "",
        category:
          word.category || "기타",
        created_at:
          word.created_at,
      }));

    setSavedWords(formattedWords);

    const wordIds = formattedWords.map(
      (word) => word.id
    );

    if (wordIds.length === 0) {
      setWordComments([]);
      setWordsLoading(false);
      return;
    }

    const {
      data: commentsData,
      error: commentsError,
    } = await supabase
      .from("word_comments")
      .select(
        "id, word_id, user_id, comment, created_at"
      )
      .in("word_id", wordIds)
      .order("created_at", {
        ascending: false,
      });

    if (commentsError) {
      console.error(
        "코멘트 불러오기 오류:",
        commentsError
      );

      setWordComments([]);
    } else {
      setWordComments(
        commentsData || []
      );
    }

    setWordsLoading(false);
  };

  // =========================
  // 기존 사전 검색
  // =========================
  const getMeaning = (value: string) => {
    return meaningDictionary[
      value.trim()
    ] || "";
  };

  // =========================
  // 코멘트
  // =========================
  const getCommentsForWord = (
    wordId: string
  ) => {
    return wordComments.filter(
      (item) => item.word_id === wordId
    );
  };

  const isAdminComment = (
    comment: WordComment
  ) => {
    return !comment.user_id;
  };

  const hideComment = (
    commentId: string
  ) => {
    setHiddenCommentIds((prev) =>
      prev.includes(commentId)
        ? prev
        : [...prev, commentId]
    );
  };

  const showComment = (
    commentId: string
  ) => {
    setHiddenCommentIds((prev) =>
      prev.filter(
        (id) => id !== commentId
      )
    );
  };

  // =========================
  // 사용자 코멘트 등록
  // =========================
  const addUserComment = async (
    wordId: string
  ) => {
    if (!user) {
      setErrorMessage(
        "로그인이 필요합니다."
      );
      return;
    }

    const commentText =
      (
        newCommentText[wordId] ||
        ""
      ).trim();

    if (!commentText) {
      setErrorMessage(
        "코멘트 내용을 입력해 주세요."
      );
      return;
    }

    setCommentLoadingId(wordId);
    setErrorMessage("");

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      setErrorMessage(
        "로그인 정보를 확인할 수 없습니다."
      );

      setCommentLoadingId(null);
      return;
    }

    const { data, error } =
      await supabase
        .from("word_comments")
        .insert({
          word_id: wordId,
          user_id: authUser.id,
          comment: commentText,
        })
        .select(
          "id, word_id, user_id, comment, created_at"
        )
        .single();

    if (error) {
      console.error(
        "사용자 코멘트 저장 오류:",
        error
      );

      setErrorMessage(
        "코멘트 저장에 실패했습니다: " +
          error.message
      );

      setCommentLoadingId(null);
      return;
    }

    setWordComments((prev) => [
      data,
      ...prev,
    ]);

    setNewCommentText((prev) => ({
      ...prev,
      [wordId]: "",
    }));

    setCommentLoadingId(null);
  };

  // =========================
  // 코멘트 수정 시작
  // =========================
  const startEditComment = (
    comment: WordComment,
    commentKey: string
  ) => {
    const isMine =
      !!user?.id &&
      comment.user_id === user.id;

    const canEdit =
      (isAdmin &&
        isAdminComment(comment)) ||
      isMine;

    if (!canEdit) {
      return;
    }

    setEditingCommentKey(
      commentKey
    );

    setEditCommentText(
      comment.comment
    );

    setErrorMessage("");
  };

  // =========================
  // 코멘트 수정 취소
  // =========================
  const cancelEditComment = () => {
    setEditingCommentKey(null);
    setEditCommentText("");
  };

  // =========================
  // 코멘트 수정
  // =========================
  const updateComment = async (
    comment: WordComment
  ) => {
    if (!user) {
      setErrorMessage(
        "로그인이 필요합니다."
      );
      return;
    }

    const updatedComment =
      editCommentText.trim();

    if (!updatedComment) {
      setErrorMessage(
        "코멘트 내용을 입력해 주세요."
      );
      return;
    }

    const isMine =
      comment.user_id === user.id;

    const canEdit =
      (isAdmin &&
        isAdminComment(comment)) ||
      isMine;

    if (!canEdit) {
      setErrorMessage(
        "이 코멘트를 수정할 권한이 없습니다."
      );
      return;
    }

    setCommentLoadingId(
      comment.word_id
    );

    setErrorMessage("");

    const { data, error } =
      await supabase
        .from("word_comments")
        .update({
          comment: updatedComment,
        })
        .eq("id", comment.id)
        .select(
          "id, word_id, user_id, comment, created_at"
        )
        .single();

    if (error) {
      console.error(
        "코멘트 수정 오류:",
        error
      );

      setErrorMessage(
        "코멘트 수정에 실패했습니다: " +
          error.message
      );

      setCommentLoadingId(null);
      return;
    }

    setWordComments((prev) =>
      prev.map((item) =>
        item.id === comment.id
          ? data
          : item
      )
    );

    setEditingCommentKey(null);
    setEditCommentText("");
    setCommentLoadingId(null);
  };

  // =========================
  // 사용자 코멘트 삭제
  // =========================
  const deleteComment = async (
    comment: WordComment
  ) => {
    if (!user) {
      setErrorMessage(
        "로그인이 필요합니다."
      );
      return;
    }

    if (
      comment.user_id !== user.id
    ) {
      setErrorMessage(
        "이 코멘트를 삭제할 권한이 없습니다."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "이 코멘트를 삭제하시겠습니까?"
      );

    if (!confirmed) {
      return;
    }

    setCommentLoadingId(
      comment.word_id
    );

    setErrorMessage("");

    const { error } =
      await supabase
        .from("word_comments")
        .delete()
        .eq("id", comment.id)
        .eq("user_id", user.id);

    if (error) {
      console.error(
        "코멘트 삭제 오류:",
        error
      );

      setErrorMessage(
        "코멘트 삭제에 실패했습니다: " +
          error.message
      );

      setCommentLoadingId(null);
      return;
    }

    setWordComments((prev) =>
      prev.filter(
        (item) =>
          item.id !== comment.id
      )
    );

    setCommentLoadingId(null);
  };

  // =========================
  // 음성 인식
  // =========================
  const startVoiceRecognition = () => {
    setErrorMessage("");

    const SpeechRecognition =
      (window as any)
        .SpeechRecognition ||
      (window as any)
        .webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMessage(
        "이 브라우저에서는 음성 인식을 지원하지 않습니다. Chrome이나 Edge를 사용해 주세요."
      );

      return;
    }

    const recognition =
      new SpeechRecognition();

    recognition.lang =
      language === "한국어"
        ? "ko-KR"
        : "zh-CN";

    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (
      event: any
    ) => {
      const result =
        event.results[0][0]
          .transcript.trim();

      setText(result);

      if (
        language === "中文"
      ) {
        const resultPinyin =
          pinyin(result, {
            toneType: "symbol",
            type: "string",
          });

        setPinyinText(
          resultPinyin
        );
      } else {
        setPinyinText("");
      }

      setIsListening(false);
    };

    recognition.onerror = (
      event: any
    ) => {
      console.error(
        "음성 인식 오류:",
        event.error
      );

      setErrorMessage(
        "음성 인식 중 오류가 발생했습니다."
      );

      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  };

  // =========================
  // 단어 저장
  // =========================
  const saveWord = async () => {
    if (!text.trim()) {
      return;
    }

    if (!user) {
      setErrorMessage(
        "로그인이 필요합니다."
      );

      return;
    }

    setSaveLoading(true);
    setErrorMessage("");

    const { data, error } =
      await supabase
        .from("words")
        .insert({
          user_id: user.id,
          language: language,
          text: text.trim(),
          pinyin_text:
            language === "中文"
              ? pinyinText
              : null,
          meaning:
            meaning || null,
          category: category,
        })
        .select()
        .single();

    if (error) {
      console.error(
        "단어 저장 오류:",
        error
      );

      setErrorMessage(
        "단어 저장에 실패했습니다: " +
          error.message
      );

      setSaveLoading(false);
      return;
    }

    const newWord: SavedWord = {
      id: data.id,
      language: data.language,
      text: data.text,
      pinyinText:
        data.pinyin_text || "",
      meaning:
        data.meaning || "",
      category:
        data.category || "기타",
      created_at:
        data.created_at,
    };

    setSavedWords((prev) => [
      newWord,
      ...prev,
    ]);

    setText("");
    setPinyinText("");
    setMeaning("");
    setCategory("일상회화");

    setSaveLoading(false);
  };

  // =========================
  // 단어 수정 시작
  // =========================
  const startEditWord = (
    word: SavedWord
  ) => {
    stopAutoPlay();

    window.speechSynthesis.cancel();

    setPlayingWordId(null);

    setEditingWordId(word.id);
    setEditText(word.text);

    setEditPinyinText(
      word.pinyinText || ""
    );

    setEditMeaning(
      word.meaning || ""
    );

    setEditCategory(word.category);
    setErrorMessage("");
  };

  // =========================
  // 단어 수정 취소
  // =========================
  const cancelEditWord = () => {
    setEditingWordId(null);
    setEditText("");
    setEditPinyinText("");
    setEditMeaning("");
    setEditCategory("일상회화");
    setEditLoading(false);
  };

  // =========================
  // 단어 수정 중 자동 번역
  // =========================
  useEffect(() => {
    if (!editingWordId) {
      return;
    }

    const trimmedText =
      editText.trim();

    if (!trimmedText) {
      setEditMeaning("");
      return;
    }

    const dictionaryMeaning =
      meaningDictionary[
        trimmedText
      ];

    if (dictionaryMeaning) {
      setEditMeaning(
        dictionaryMeaning
      );
      return;
    }

    const currentWord =
      savedWords.find(
        (word) =>
          word.id ===
          editingWordId
      );

    if (!currentWord) {
      return;
    }

    const requestId =
      ++editTranslationRequestRef.current;

    const timer = window.setTimeout(
      async () => {
        setEditTranslationLoading(
          true
        );

        const translated =
          await translateText(
            trimmedText,
            currentWord.language
          );

        if (
          requestId !==
          editTranslationRequestRef.current
        ) {
          return;
        }

        if (translated) {
          setEditMeaning(
            translated
          );
        }

        setEditTranslationLoading(
          false
        );
      },
      700
    );

    return () => {
      window.clearTimeout(timer);
    };
  }, [
    editText,
    editingWordId,
    savedWords,
  ]);

  // =========================
  // 단어 수정 저장
  // =========================
  const updateWord = async () => {
    if (!user || !editingWordId) {
      return;
    }

    if (!editText.trim()) {
      setErrorMessage(
        "단어를 입력해 주세요."
      );
      return;
    }

    setEditLoading(true);
    setErrorMessage("");

    const updatedText =
      editText.trim();

    const updatedPinyin =
      editPinyinText.trim();

    const updatedMeaning =
      editMeaning.trim();

    const updatedCategory =
      editCategory;

    try {
      const {
        data: existingWord,
        error: findError,
      } = await supabase
        .from("words")
        .select(
          "id, language, text, pinyin_text, meaning, category, created_at"
        )
        .eq("id", editingWordId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (findError) {
        console.error(
          "수정할 단어 조회 오류:",
          findError
        );

        setErrorMessage(
          "수정할 단어를 찾지 못했습니다: " +
            findError.message
        );

        setEditLoading(false);
        return;
      }

      if (!existingWord) {
        setErrorMessage(
          "수정할 단어를 찾지 못했습니다. Supabase의 RLS 정책을 확인해 주세요."
        );

        setEditLoading(false);
        return;
      }

      const {
        error: updateError,
        count,
      } = await supabase
        .from("words")
        .update(
          {
            text: updatedText,
            pinyin_text:
              updatedPinyin || null,
            meaning:
              updatedMeaning || null,
            category:
              updatedCategory,
          },
          {
            count: "exact",
          }
        )
        .eq("id", editingWordId)
        .eq("user_id", user.id);

      if (updateError) {
        console.error(
          "단어 수정 오류:",
          updateError
        );

        setErrorMessage(
          "단어 수정에 실패했습니다: " +
            updateError.message
        );

        setEditLoading(false);
        return;
      }

      if (count !== 1) {
        setErrorMessage(
          "데이터베이스에 단어가 저장되지 않았습니다. Supabase의 words 테이블 UPDATE RLS 정책을 확인해 주세요."
        );

        setEditLoading(false);
        return;
      }

      const {
        data: savedWord,
        error: verifyError,
      } = await supabase
        .from("words")
        .select(
          "id, language, text, pinyin_text, meaning, category, created_at"
        )
        .eq("id", editingWordId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (verifyError) {
        console.error(
          "수정 결과 확인 오류:",
          verifyError
        );

        setErrorMessage(
          "수정은 완료됐지만 저장 결과를 확인하지 못했습니다: " +
            verifyError.message
        );

        setEditLoading(false);
        return;
      }

      if (!savedWord) {
        setErrorMessage(
          "수정된 단어를 다시 불러오지 못했습니다."
        );

        setEditLoading(false);
        return;
      }

      const updatedWord: SavedWord = {
        id: savedWord.id,
        language:
          savedWord.language ||
          existingWord.language ||
          "한국어",
        text: savedWord.text,
        pinyinText:
          savedWord.pinyin_text || "",
        meaning:
          savedWord.meaning || "",
        category:
          savedWord.category ||
          "일상회화",
        created_at:
          savedWord.created_at,
      };

      setSavedWords((prev) =>
        prev.map((word) =>
          word.id === editingWordId
            ? updatedWord
            : word
        )
      );

      setEditingWordId(null);
      setEditText("");
      setEditPinyinText("");
      setEditMeaning("");
      setEditCategory("일상회화");
      setEditLoading(false);

      window.speechSynthesis.cancel();

      setIsAutoPlaying(false);
      setPlayingWordId(null);
    } catch (error) {
      console.error(
        "단어 수정 중 예외 발생:",
        error
      );

      setErrorMessage(
        "단어 수정 중 오류가 발생했습니다."
      );

      setEditLoading(false);
    }
  };

  // =========================
  // 단어 삭제
  // =========================
  const toggleMeaningVisibility = (wordId: string) => {
  setVisibleMeaningIds((prev) => {
    if (prev.includes(wordId)) {
      return prev.filter((id) => id !== wordId);
    }

    return [...prev, wordId];
  });
};
  const deleteWord = async (
    wordId: string
  ) => {
    if (!user) {
      setErrorMessage(
        "로그인이 필요합니다."
      );
      return;
    }

    const [visibleMeaningIds, setVisibleMeaningIds] =
  useState<string[]>([]);

const toggleMeaningVisibility = (wordId: string) => {
  setVisibleMeaningIds((prev) =>
    prev.includes(wordId)
      ? prev.filter((id) => id !== wordId)
      : [...prev, wordId]
  );
};
 

    const confirmed =
      window.confirm(
        "이 단어를 삭제하시겠습니까?"
      );

    if (!confirmed) {
      return;
    }

    setErrorMessage("");

    const { error } =
      await supabase
        .from("words")
        .delete()
        .eq("id", wordId)
        .eq("user_id", user.id);

    if (error) {
      console.error(
        "단어 삭제 오류:",
        error
      );

      setErrorMessage(
        "단어 삭제에 실패했습니다: " +
          error.message
      );

      return;
    }

    setSavedWords((prev) =>
      prev.filter(
        (word) =>
          word.id !== wordId
      )
    );

    setWordComments((prev) =>
      prev.filter(
        (comment) =>
          comment.word_id !== wordId
      )
    );

    if (
      editingWordId === wordId
    ) {
      cancelEditWord();
    }
  };

  // =========================
  // 단어 음성 재생
  // =========================
  const speakWord = (
    word: SavedWord
  ) => {
    if (
      !("speechSynthesis" in window)
    ) {
      setErrorMessage(
        "이 브라우저에서는 음성 재생을 지원하지 않습니다."
      );
      return;
    }

    window.speechSynthesis.cancel();

    setPlayingWordId(word.id);

    const utterance =
      new SpeechSynthesisUtterance(
        word.text
      );

    utterance.lang =
      word.language === "中文"
        ? "zh-CN"
        : "ko-KR";

    utterance.rate = 0.85;
    utterance.pitch = 1;

    utterance.onend = () => {
      setPlayingWordId(null);
    };

    utterance.onerror = (
      event
    ) => {
      if (
        event.error !==
          "interrupted" &&
        event.error !== "canceled"
      ) {
        console.error(
          "음성 재생 오류:",
          event
        );
      }

      setPlayingWordId(null);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };

  // =========================
  // 전체 음성 순차 재생
  // =========================
  const speakWordsSequentially = (
    words: SavedWord[],
    index: number
  ) => {
    if (
      !autoPlayingRef.current ||
      index >= words.length
    ) {
      autoPlayingRef.current =
        false;

      setIsAutoPlaying(false);
      setPlayingWordId(null);

      return;
    }

    const word = words[index];

    setPlayingWordId(word.id);

    const utterance =
      new SpeechSynthesisUtterance(
        word.text
      );

    utterance.lang =
      word.language === "中文"
        ? "zh-CN"
        : "ko-KR";

    utterance.rate = 0.85;
    utterance.pitch = 1;

    utterance.onend = () => {
      if (!autoPlayingRef.current) {
        return;
      }

      setTimeout(() => {
        speakWordsSequentially(
          words,
          index + 1
        );
      }, 700);
    };

    utterance.onerror = () => {
      autoPlayingRef.current =
        false;

      setIsAutoPlaying(false);
      setPlayingWordId(null);
    };

    window.speechSynthesis.speak(
      utterance
    );
  };

  const startAutoPlay = () => {
    if (
      filteredWords.length === 0
    ) {
      return;
    }

    if (
      !("speechSynthesis" in window)
    ) {
      setErrorMessage(
        "이 브라우저에서는 음성 재생을 지원하지 않습니다."
      );

      return;
    }

    window.speechSynthesis.cancel();

    autoPlayingRef.current = true;

    setIsAutoPlaying(true);

    speakWordsSequentially(
      filteredWords,
      0
    );
  };

  const stopAutoPlay = () => {
    autoPlayingRef.current =
      false;

    window.speechSynthesis.cancel();

    setIsAutoPlaying(false);
    setPlayingWordId(null);
  };

  // =========================
  // 로그인
  // =========================
  const handleLogin = async () => {
    setAuthMessage("");
    setErrorMessage("");

    const { error } =
      await supabase.auth.signInWithPassword(
        {
          email,
          password,
        }
      );

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    setAuthMessage(
      "로그인되었습니다."
    );
  };

  // =========================
  // 회원가입
  // =========================
  const handleSignup = async () => {
    setAuthMessage("");
    setErrorMessage("");

    const { error } =
      await supabase.auth.signUp({
        email,
        password,
      });

    if (error) {
      setErrorMessage(
        error.message
      );

      return;
    }

    setAuthMessage(
      "회원가입이 완료되었습니다. 이메일 인증이 필요한 경우 이메일을 확인해 주세요."
    );
  };

  // =========================
  // 로그아웃
  // =========================
  const handleLogout = async () => {
    stopAutoPlay();

    await supabase.auth.signOut();

    setUser(null);
    setSavedWords([]);
    setWordComments([]);
  };

  const filteredWords =
    selectedCategory === "전체"
      ? savedWords
      : savedWords.filter(
          (word) =>
            word.category ===
            selectedCategory
        );

  return (
    <main
      style={{
        maxWidth: "900px",
        margin: "0 auto",
        padding: "40px 20px",
        fontFamily:
          "Arial, sans-serif",
      }}
    >
      <h1
        style={{
          marginBottom: "10px",
        }}
      >
        Smart Language Notebook
      </h1>

      {!user ? (
        <section
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "20px",
            marginBottom: "30px",
          }}
        >
          <h2>
            {isAuthMode === "login"
              ? "로그인"
              : "회원가입"}
          </h2>

          {authMessage && (
            <div
              style={{
                color: "green",
                marginBottom:
                  "15px",
              }}
            >
              {authMessage}
            </div>
          )}
             {errorMessage && (
            <div
              style={{
                color: "red",
                marginBottom:
                  "15px",
              }}
            >
              {errorMessage}
            </div>
          )}

          <input
            type="email"
            placeholder="이메일"
            value={email}
            onChange={(e) =>
              setEmail(
                e.target.value
              )
            }
            style={{
              display: "block",
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
              boxSizing:
                "border-box",
            }}
          />

          <input
            type="password"
            placeholder="비밀번호"
            value={password}
            onChange={(e) =>
              setPassword(
                e.target.value
              )
            }
            style={{
              display: "block",
              width: "100%",
              padding: "12px",
              marginBottom: "10px",
              boxSizing:
                "border-box",
            }}
          />

          <button
            onClick={
              isAuthMode === "login"
                ? handleLogin
                : handleSignup
            }
            style={{
              padding:
                "10px 20px",
              cursor:
                "pointer",
            }}
          >
            {isAuthMode === "login"
              ? "로그인"
              : "회원가입"}
          </button>

          <button
            onClick={() =>
              setIsAuthMode(
                isAuthMode === "login"
                  ? "signup"
                  : "login"
              )
            }
            style={{
              marginLeft: "10px",
              padding:
                "10px 20px",
              cursor:
                "pointer",
            }}
          >
            {isAuthMode === "login"
              ? "회원가입"
              : "로그인으로 돌아가기"}
          </button>
        </section>
      ) : (
        <section
          style={{
            marginBottom: "25px",
            padding: "15px",
            background:
              "#f5f5f5",
            borderRadius: "10px",
          }}
        >
          <div
            style={{
              marginBottom:
                "10px",
            }}
          >
            로그인:{" "}
            {user.email}
          </div>

          <button
            onClick={
              handleLogout
            }
            style={{
              padding:
                "8px 16px",
              cursor:
                "pointer",
            }}
          >
            로그아웃
          </button>
        </section>
      )}

      {user && (
        <>
          <section
            style={{
              border:
                "1px solid #ddd",
              borderRadius:
                "12px",
              padding:
                "20px",
              marginBottom:
                "30px",
            }}
          >
            <h2>단어 입력</h2>

            <select
              value={language}
              onChange={(e) => {
                setLanguage(
                  e.target.value
                );

                setText("");
                setPinyinText("");
                setMeaning("");
              }}
              style={{
                padding:
                  "10px",
                marginBottom:
                  "15px",
                width: "100%",
              }}
            >
              <option value="한국어">
                한국어 → English
              </option>

              <option value="中文">
                中文 → 한국어
              </option>
            </select>

            <button
              onClick={
                startVoiceRecognition
              }
              disabled={
                isListening
              }
              style={{
                padding:
                  "12px 20px",
                cursor:
                  isListening
                    ? "default"
                    : "pointer",
                marginBottom:
                  "15px",
              }}
            >
              {isListening
                ? "🎤 듣는 중..."
                : "🎤 음성으로 입력"}
            </button>

            <input
              value={text}
              onChange={(e) => {
                const value =
                  e.target.value;

                setText(value);

                if (
                  language ===
                  "中文"
                ) {
                  setPinyinText(
                    pinyin(
                      value,
                      {
                        toneType:
                          "symbol",
                        type: "string",
                      }
                    )
                  );
                } else {
                  setPinyinText("");
                }
              }}
              placeholder={
                language === "中文"
                  ? "중국어 단어를 입력하세요"
                  : "한국어 단어를 입력하세요"
              }
              style={{
                display:
                  "block",
                width: "100%",
                padding:
                  "12px",
                marginBottom:
                  "15px",
                boxSizing:
                  "border-box",
              }}
            />

            {text && (
              <div
                style={{
                  padding:
                    "15px",
                  background:
                    "#f8f8f8",
                  borderRadius:
                    "10px",
                  marginBottom:
                    "15px",
                }}
              >
                <div>
                  <strong>
                    단어:
                  </strong>{" "}
                  {text}
                </div>

                {language ===
                  "中文" &&
                  pinyinText && (
                    <div
                      style={{
                        marginTop:
                          "8px",
                      }}
                    >
                      <strong>
                        병음:
                      </strong>{" "}
                      {
                        pinyinText
                      }
                    </div>
                  )}

                <div
                  style={{
                    marginTop:
                      "8px",
                  }}
                >
                  <strong>
                    {language ===
                    "中文"
                      ? "한국어 뜻:"
                      : "English:"}
                  </strong>{" "}
                  {translationLoading
                    ? "번역 중..."
                    : meaning ||
                      "번역 결과가 없습니다."}
                </div>
              </div>
            )}

            <label
              style={{
                display:
                  "block",
                marginBottom:
                  "8px",
                fontWeight:
                  "bold",
              }}
            >
              카테고리
            </label>

            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value
                )
              }
              style={{
                padding:
                  "10px",
                width: "100%",
                marginBottom:
                  "15px",
              }}
            >
              {categories.map(
                (item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                )
              )}
            </select>

            <button
              onClick={
                saveWord
              }
              disabled={
                saveLoading ||
                !text.trim()
              }
              style={{
                padding:
                  "12px 20px",
                cursor:
                  saveLoading ||
                  !text.trim()
                    ? "default"
                    : "pointer",
              }}
            >
              {saveLoading
                ? "저장 중..."
                : "💾 저장"}
            </button>
          </section>

       

          <section>
            <h2>내 단어장</h2>

            <div
              style={{
                display:
                  "flex",
                gap: "8px",
                flexWrap:
                  "wrap",
                marginBottom:
                  "20px",
              }}
            >
              <button
                onClick={() => {
                  stopAutoPlay();

                  setSelectedCategory(
                    "전체"
                  );
                }}
                style={{
                  padding:
                    "8px 14px",
                  cursor:
                    "pointer",
                  fontWeight:
                    selectedCategory ===
                    "전체"
                      ? "bold"
                      : "normal",
                }}
              >
                전체
              </button>

              {categories.map(
                (item) => (
                  <button
                    key={item}
                    onClick={() => {
                      stopAutoPlay();

                      setSelectedCategory(
                        item
                      );
                    }}
                    style={{
                      padding:
                        "8px 14px",
                      cursor:
                        "pointer",
                      fontWeight:
                        selectedCategory ===
                        item
                          ? "bold"
                          : "normal",
                    }}
                  >
                    {item}
                  </button>
                )
              )}
            </div>

            <div
              style={{
                display:
                  "flex",
                gap: "10px",
                marginBottom:
                  "20px",
              }}
            >
              <button
                onClick={
                  startAutoPlay
                }
                disabled={
                  isAutoPlaying ||
                  filteredWords.length ===
                    0
                }
                style={{
                  padding:
                    "10px 16px",
                  cursor:
                    isAutoPlaying ||
                    filteredWords.length ===
                      0
                      ? "default"
                      : "pointer",
                }}
              >
                ▶ 전체 재생
              </button>

              <button
                onClick={
                  stopAutoPlay
                }
                disabled={
                  !isAutoPlaying
                }
                style={{
                  padding:
                    "10px 16px",
                  cursor:
                    isAutoPlaying
                      ? "pointer"
                      : "default",
                }}
              >
                ⏹ 정지
              </button>
            </div>

            <div
              style={{
                marginBottom:
                  "15px",
                color:
                  "#666",
              }}
            >
              {selectedCategory ===
              "전체"
                ? "전체 단어"
                : selectedCategory}{" "}
              ·{" "}
              {
                filteredWords.length
              }
              개
            </div>

            {wordsLoading ? (
              <p>
                단어를 불러오는 중...
              </p>
            ) : filteredWords.length ===
              0 ? (
              <p>
                이 카테고리에 저장된
                단어가 없습니다.
              </p>
            ) : (
              <div>
                {filteredWords.map(
                  (word) => {
                    const isEditing =
                      editingWordId ===
                      word.id;

                    return (
                      <div
                        key={word.id}
                        style={{
                          border:
                            "1px solid #ddd",
                          borderRadius:
                            "10px",
                          padding:
                            "15px",
                          marginBottom:
                            "10px",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            justifyContent:
                              "space-between",
                            alignItems:
                              "flex-start",
                            gap:
                              "15px",
                          }}
                        >
                          <div
                            style={{
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            <div
                              style={{
                                fontSize:
                                  "12px",
                                color:
                                  "#666",
                                marginBottom:
                                  "5px",
                              }}
                            >
                              {
                                word.category
                              }
                            </div>

                            {isEditing ? (
                              <div>
                                <input
                                  value={
                                    editText
                                  }
                                  onChange={(
                                    e
                                  ) => {
                                    const value =
                                      e.target
                                        .value;

                                    setEditText(
                                      value
                                    );

                                    if (
                                      word.language ===
                                      "中文"
                                    ) {
                                      setEditPinyinText(
                                        pinyin(
                                          value,
                                          {
                                            toneType:
                                              "symbol",
                                            type: "string",
                                          }
                                        )
                                      );
                                    } else {
                                      setEditPinyinText(
                                        ""
                                      );
                                    }
                                  }}
                                  style={{
                                    display:
                                      "block",
                                    width:
                                      "100%",
                                    padding:
                                      "8px",
                                    marginBottom:
                                      "8px",
                                    boxSizing:
                                      "border-box",
                                    fontSize:
                                      "16px",
                                  }}
                                />

                                {word.language ===
                                  "中文" && (
                                  <input
                                    value={
                                      editPinyinText
                                    }
                                    onChange={(
                                      e
                                    ) =>
                                      setEditPinyinText(
                                        e
                                          .target
                                          .value
                                      )
                                    }
                                    placeholder="병음"
                                    style={{
                                      display:
                                        "block",
                                      width:
                                        "100%",
                                      padding:
                                        "8px",
                                      marginBottom:
                                        "8px",
                                      boxSizing:
                                        "border-box",
                                    }}
                                  />
                                )}

                                <input
                                  value={
                                    editMeaning
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    setEditMeaning(
                                      e
                                        .target
                                        .value
                                    )
                                  }
                                  placeholder={
                                    word.language ===
                                    "中文"
                                      ? "한국어 뜻"
                                      : "영어 뜻"
                                  }
                                  style={{
                                    display:
                                      "block",
                                    width:
                                      "100%",
                                    padding:
                                      "8px",
                                    marginBottom:
                                      "8px",
                                    boxSizing:
                                      "border-box",
                                  }}
                                />

                                {editTranslationLoading && (
                                  <div
                                    style={{
                                      fontSize:
                                        "12px",
                                      color:
                                        "#777",
                                      marginBottom:
                                        "8px",
                                    }}
                                  >
                                    번역 중...
                                  </div>
                                )}

                                <select
                                  value={
                                    editCategory
                                  }
                                  onChange={(
                                    e
                                  ) =>
                                    setEditCategory(
                                      e
                                        .target
                                        .value
                                    )
                                  }
                                  style={{
                                    padding:
                                      "8px",
                                    width:
                                      "100%",
                                    marginBottom:
                                      "10px",
                                  }}
                                >
                                  {categories.map(
                                    (
                                      item
                                    ) => (
                                      <option
                                        key={
                                          item
                                        }
                                        value={
                                          item
                                        }
                                      >
                                        {
                                          item
                                        }
                                      </option>
                                    )
                                  )}
                                </select>

                                <div
                                  style={{
                                    display:
                                      "flex",
                                    gap:
                                      "6px",
                                  }}
                                >
                                  <button
                                    onClick={
                                      updateWord
                                    }
                                    disabled={
                                      editLoading
                                    }
                                    style={{
                                      padding:
                                        "7px 12px",
                                      cursor:
                                        editLoading
                                          ? "default"
                                          : "pointer",
                                    }}
                                  >
                                    {editLoading
                                      ? "저장 중..."
                                      : "저장"}
                                  </button>

                                  <button
                                    onClick={
                                      cancelEditWord
                                    }
                                    disabled={
                                      editLoading
                                    }
                                    style={{
                                      padding:
                                        "7px 12px",
                                      cursor:
                                        "pointer",
                                    }}
                                  >
                                    취소
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div>
                                  <strong>
                                    {
                                      word.text
                                    }
                                  </strong>
                                </div>

                                {word.pinyinText && (
                                  <div
                                    style={{
                                      marginTop:
                                        "5px",
                                    }}
                                  >
                                    {
                                      word.pinyinText
                                    }
                                  </div>
                                )}

                                <div
                                  style={{
                                    marginTop:
                                      "5px",
                                    color:
                                      "#555",
                                  }}
                                >
                                  {
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "8px",
                                      }}
                                    >
                                      <span>
                                        {visibleMeaningIds.includes(word.id)
                                          ? word.meaning
                                          : "••••••••"}
                                      </span>

                                      <button
                                        type="button"
                                        onClick={() =>
                                          toggleMeaningVisibility(word.id)
                                        }
                                        style={{
                                          border: "none",
                                          background: "transparent",
                                          cursor: "pointer",
                                          fontSize: "18px",
                                          padding: "2px 4px",
                                        }}
                                        title={
                                          visibleMeaningIds.includes(word.id)
                                            ? "뜻 숨기기"
                                            : "뜻 보기"
                                        }
                                      >
                                        {visibleMeaningIds.includes(word.id)
                                          ? "👁️"
                                          : "🙈"}
                                      </button>
                                    </div>
                                  }
                                </div>
                              </>
                            )}
                          </div>

                          <div
                            style={{
                              display:
                                "flex",
                              gap:
                                "6px",
                              flexShrink:
                                0,
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <button
                              onClick={() => {
                                speakWord(
                                  word
                                );
                              }}
                              style={{
                                padding:
                                  "6px 10px",
                                cursor:
                                  "pointer",
                              }}
                            >
                              {playingWordId ===
                              word.id
                                ? "🔊 재생 중"
                                : "🔊 듣기"}
                            </button>

                            <button
                              onClick={() =>
                                startEditWord(
                                  word
                                )
                              }
                              style={{
                                padding:
                                  "6px 10px",
                                cursor:
                                  "pointer",
                              }}
                            >
                              ✏️ 수정
                            </button>

                            <button
                              onClick={() =>
                                deleteWord(
                                  word.id
                                )
                              }
                              disabled={
                                isEditing
                              }
                              style={{
                                padding:
                                  "6px 10px",
                                cursor:
                                  isEditing
                                    ? "default"
                                    : "pointer",
                              }}
                            >
                              삭제
                            </button>
                          </div>
                        </div>

                        {/* =========================
                            코멘트 영역
                           ========================= */}
                        {getCommentsForWord(
                          word.id
                        ).map(
                          (
                            comment
                          ) => {
                            const commentKey =
                              comment.id;

                            const adminComment =
                              isAdminComment(
                                comment
                              );

                            const hidden =
                              hiddenCommentIds.includes(
                                commentKey
                              );

                            const isEditingComment =
                              editingCommentKey ===
                              commentKey;

                            const isMyComment =
                              comment.user_id ===
                              user?.id;

                            return (
                              <div
                                key={
                                  commentKey
                                }
                                style={{
                                  marginTop:
                                    "12px",
                                  padding:
                                    "10px 12px",
                                  background:
                                    adminComment
                                      ? "#fff8e1"
                                      : "#f5f8ff",
                                  borderRadius:
                                    "8px",
                                  border:
                                    adminComment
                                      ? "1px solid #f0df9a"
                                      : "1px solid #dbe5ff",
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    justifyContent:
                                      "space-between",
                                    alignItems:
                                      "center",
                                    gap:
                                      "8px",
                                  }}
                                >
                                  <div
                                    style={{
                                      fontWeight:
                                        "bold",
                                    }}
                                  >
                                    {adminComment
                                      ? "📌 관리자 코멘트"
                                      : isMyComment
                                      ? "💬 내 코멘트"
                                      : "💬 사용자 코멘트"}
                                  </div>

                                  {!isEditingComment && (
                                    <div
                                      style={{
                                        display:
                                          "flex",
                                        gap:
                                          "6px",
                                        flexShrink:
                                          0,
                                        flexWrap:
                                          "wrap",
                                      }}
                                    >
                                      {adminComment &&
                                        isAdmin && (
                                          <>
                                            {hidden ? (
                                              <button
                                                onClick={() =>
                                                  showComment(
                                                    commentKey
                                                  )
                                                }
                                                style={{
                                                  padding:
                                                    "4px 8px",
                                                  cursor:
                                                    "pointer",
                                                }}
                                              >
                                                👁️ 보기
                                              </button>
                                            ) : (
                                              <button
                                                onClick={() =>
                                                  hideComment(
                                                    commentKey
                                                  )
                                                }
                                                style={{
                                                  padding:
                                                    "4px 8px",
                                                  cursor:
                                                    "pointer",
                                                }}
                                              >
                                                🔒 숨기기
                                              </button>
                                            )}
                                          </>
                                        )}

                                      {isAdmin &&
                                        adminComment && (
                                          <button
                                            onClick={() =>
                                              startEditComment(
                                                comment,
                                                commentKey
                                              )
                                            }
                                            style={{
                                              padding:
                                                "4px 8px",
                                              cursor:
                                                "pointer",
                                            }}
                                          >
                                            ✏️ 수정
                                          </button>
                                        )}

                                      {isMyComment && (
                                        <button
                                          onClick={() =>
                                            startEditComment(
                                              comment,
                                              commentKey
                                            )
                                          }
                                          style={{
                                            padding:
                                              "4px 8px",
                                            cursor:
                                              "pointer",
                                          }}
                                        >
                                          ✏️ 수정
                                        </button>
                                      )}

                                      {isMyComment && (
                                        <button
                                          onClick={() =>
                                            deleteComment(
                                              comment
                                            )
                                          }
                                          disabled={
                                            commentLoadingId ===
                                            comment.word_id
                                          }
                                          style={{
                                            padding:
                                              "4px 8px",
                                            cursor:
                                              commentLoadingId ===
                                              comment.word_id
                                                ? "default"
                                                : "pointer",
                                          }}
                                        >
                                          🗑️ 삭제
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {isEditingComment ? (
                                  <div
                                    style={{
                                      marginTop:
                                        "8px",
                                    }}
                                  >
                                    <textarea
                                      value={
                                        editCommentText
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        setEditCommentText(
                                          e.target
                                            .value
                                        )
                                      }
                                      rows={3}
                                      style={{
                                        width:
                                          "100%",
                                        padding:
                                          "8px",
                                        boxSizing:
                                          "border-box",
                                        resize:
                                          "vertical",
                                      }}
                                    />

                                    <div
                                      style={{
                                        display:
                                          "flex",
                                        gap:
                                          "6px",
                                        marginTop:
                                          "6px",
                                      }}
                                    >
                                      <button
                                        onClick={() =>
                                          updateComment(
                                            comment
                                          )
                                        }
                                        disabled={
                                          commentLoadingId ===
                                          comment.word_id
                                        }
                                        style={{
                                          padding:
                                            "6px 10px",
                                          cursor:
                                            commentLoadingId ===
                                            comment.word_id
                                              ? "default"
                                              : "pointer",
                                        }}
                                      >
                                        {commentLoadingId ===
                                        comment.word_id
                                          ? "저장 중..."
                                          : "저장"}
                                      </button>

                                      <button
                                        onClick={
                                          cancelEditComment
                                        }
                                        style={{
                                          padding:
                                            "6px 10px",
                                          cursor:
                                            "pointer",
                                        }}
                                      >
                                        취소
                                      </button>
                                    </div>
                                  </div>
                                ) : hidden &&
                                  adminComment &&
                                  isAdmin ? (
                                  <div
                                    style={{
                                      marginTop:
                                        "8px",
                                      color:
                                        "#777",
                                    }}
                                  >
                                    🔒 숨겨진 관리자 코멘트입니다.
                                  </div>
                                ) : (
                                  <div
                                    style={{
                                      marginTop:
                                        "8px",
                                      color:
                                        "#555",
                                      lineHeight:
                                        "1.5",
                                      whiteSpace:
                                        "pre-wrap",
                                    }}
                                  >
                                    {
                                      comment.comment
                                    }
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}

                        {/* =========================
                            사용자 코멘트 입력
                           ========================= */}
                        <div
                          style={{
                            marginTop:
                              "12px",
                            padding:
                              "10px 12px",
                            background:
                              "#fafafa",
                            borderRadius:
                              "8px",
                            border:
                              "1px solid #ddd",
                          }}
                        >
                          <div
                            style={{
                              fontWeight:
                                "bold",
                              marginBottom:
                                "7px",
                            }}
                          >
                            💬 내 코멘트 작성
                          </div>

                          <textarea
                            value={
                              newCommentText[
                                word.id
                              ] || ""
                            }
                            onChange={(e) =>
                              setNewCommentText(
                                (
                                  prev
                                ) => ({
                                  ...prev,
                                  [word.id]:
                                    e
                                      .target
                                      .value,
                                })
                              )
                            }
                            placeholder="이 단어에 대한 메모나 질문을 적어보세요.
예: 이 표현은 어떤 상황에서 사용하나요?"
                            rows={2}
                            style={{
                              width:
                                "100%",
                              padding:
                                "8px",
                              boxSizing:
                                "border-box",
                              resize:
                                "vertical",
                            }}
                          />

                          <button
                            onClick={() =>
                              addUserComment(
                                word.id
                              )
                            }
                            disabled={
                              commentLoadingId ===
                                word.id ||
                              !(
                                newCommentText[
                                  word.id
                                ] || ""
                              ).trim()
                            }
                            style={{
                              marginTop:
                                "7px",
                              padding:
                                "7px 12px",
                              cursor:
                                commentLoadingId ===
                                  word.id ||
                                !(
                                  newCommentText[
                                    word.id
                                  ] || ""
                                ).trim()
                                  ? "default"
                                  : "pointer",
                            }}
                          >
                            {commentLoadingId ===
                            word.id
                              ? "등록 중..."
                              : "코멘트 등록"}
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </section>
        </>
      )}
    </main>
  );
}