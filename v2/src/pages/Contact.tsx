import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';

const ENC = '7981269 2151 94+';

export function Contact() {
  const [phone, setPhone] = useState('');
  useEffect(() => { setPhone(ENC.split('').reverse().join('')); }, []);

  return (
    <Layout page="contact" contentClass="content--contact">
      <div className="col-label">
        <span className="label-kicker">Conrad Löffler</span>
        <h1 className="label-heading">Pull up<br />or reach<br />out.<br />Already.</h1>
      </div>

      <div className="col-fields">
        <div className="field">
          <span className="field-idx">001</span>
          <div>
            <div className="field-label">Email</div>
            <div className="field-value">
              <a href="mailto:connilefleur@protonmail.com">connilefleur@protonmail.com</a>
            </div>
          </div>
        </div>

        {phone && (
          <div className="field">
            <span className="field-idx">002</span>
            <div>
              <div className="field-label">Phone</div>
              <div className="field-value">
                <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
              </div>
            </div>
          </div>
        )}

        <div className="field">
          <span className="field-idx">003</span>
          <div>
            <div className="field-label">Studio</div>
            <div className="field-value">Hamburg, DE · Remote</div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">004</span>
          <div>
            <div className="field-label">Services</div>
            <div className="field-value is-mute">
              Houdini simulation and procedural FX<br />
              Lookdev, rendering and USD pipeline<br />
              Product and industrial 3D<br />
              VFX supervision and technical direction<br />
              Web development and agentic tooling<br />
              Color grading and delivery
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
