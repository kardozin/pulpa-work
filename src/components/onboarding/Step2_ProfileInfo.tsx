import React from 'react';

interface ProfileData {
  fullName: string;
  role: string;
  goals: string;
}

interface Step2ProfileInfoProps {
  profileData: ProfileData;
  onDataChange: (field: keyof ProfileData, value: string) => void;
}

const Step2_ProfileInfo: React.FC<Step2ProfileInfoProps> = ({ profileData, onDataChange }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    onDataChange(name as keyof ProfileData, value);
  };

  return (
    <div className="w-full text-center">
      <h2 className="text-3xl font-light text-text-main mb-2">Tell us a bit about yourself</h2>
      <p className="text-text-secondary mb-8">This information will help us personalize your experience.</p>

      <form className="space-y-6 text-left">
        <div>
          <label htmlFor="fullName" className="block text-sm font-medium text-text-secondary mb-2">Full Name</label>
          <input
            type="text"
            id="fullName"
            name="fullName"
            value={profileData.fullName}
            onChange={handleInputChange}
            className="form-input rounded-full"
            placeholder="E.g., Jane Doe"
          />
        </div>

        <div>
          <label htmlFor="role" className="block text-sm font-medium text-text-secondary mb-2">Your Role or Profession</label>
          <input
            type="text"
            id="role"
            name="role"
            value={profileData.role}
            onChange={handleInputChange}
            className="form-input rounded-full"
            placeholder="E.g., Product Manager"
          />
        </div>

        <div>
          <label htmlFor="goals" className="block text-sm font-medium text-text-secondary mb-2">Your Goals</label>
          <textarea
            id="goals"
            name="goals"
            value={profileData.goals}
            onChange={handleInputChange}
            rows={4}
            className="form-input rounded-full"
            placeholder="E.g., Improve my communication in meetings, prepare for an important presentation..."
          />
          <p className="text-xs text-text-secondary mt-2">This gives the AI context to make your conversations more relevant and productive.</p>
        </div>
      </form>
    </div>
  );
};

export default Step2_ProfileInfo;
