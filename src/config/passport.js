import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? null;

        if (!email) {
          return done(new Error('Google account must have an email address associated with it.'), null);
        }

        // 1. Check if user already exists with this googleId
        let user = await User.findOne({ googleId: profile.id });
        if (user) return done(null, user);

        // 2. Check if user exists with the same email — link Google ID to existing account
        user = await User.findOne({ email });
        if (user) {
          user.googleId = profile.id;
          if (!user.avatar && profile.photos?.[0]) user.avatar = profile.photos[0].value;
          await user.save();
          return done(null, user);
        }

        // 3. Create a brand new user with a temporary username
        const shortGoogleId = profile.id.substring(0, 6);
        const randomNum = Math.floor(Math.random() * 10000);
        const tempUsername = `user_${shortGoogleId}_${randomNum}`;

        user = new User({
          name: profile.displayName || 'Google User',
          username: tempUsername,
          email,
          googleId: profile.id,
          avatar: profile.photos?.[0]?.value || '',
          isOnboarded: false,
          role: 'user',
        });

        await user.save();
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Stateless JWT backend — serialize/deserialize kept minimal
passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});
