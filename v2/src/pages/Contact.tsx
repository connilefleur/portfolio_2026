import { useEffect, useState } from 'react';
import { Layout, Clock } from '../components/Layout';

const ENC = '7981269 2151 94+';

export function Contact() {
  const [phone, setPhone] = useState('');
  useEffect(() => { setPhone(ENC.split('').reverse().join('')); }, []);

  const meta = (
    <>
      <span className="dot" />
      <span>HAM · 53.55 N</span>
      <span>·</span>
      <Clock />
    </>
  );

  return (
    <Layout page="contact" meta={meta} contentClass="content--contact">
      <div className="col-label">
        <span className="label-kicker">Get in touch</span>
        <h1 className="label-heading">Let's<br />work<br />together.</h1>
        <p className="label-sub">
          Technical Director &amp; Simulation Developer.<br />
          Houdini-primary with a deep USD pipeline<br />
          foundation — enabling procedural simulation<br />
          at scale, digital twin integration and<br />
          agent-driven workflow automation.<br />
          <br />
          VFX, product, industrial and agency work.<br />
          Hamburg or remote.
        </p>
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
            <div className="field-label">Availability</div>
            <div className="field-value">
              <span className="avail">
                <span className="avail-dot" aria-hidden="true" />
                Open to new projects
              </span>
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">005</span>
          <div>
            <div className="field-label">Focus</div>
            <div className="field-value is-mute">
              Procedural Houdini · VFX Supervision<br />
              USD Pipeline · Digital Twin · Simulation<br />
              Technical Direction · Lookdev
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">006</span>
          <div>
            <div className="field-label">Services</div>
            <div className="field-value is-mute">
              Procedural Houdini · simulation · VFX<br />
              USD pipeline · digital twin workflows<br />
              Agent-driven simulation automation<br />
              Product &amp; abstract 3D · technical direction<br />
              Lookdev · rendering · AOV/ACES delivery
            </div>
          </div>
        </div>

        <div className="field">
          <span className="field-idx">007</span>
          <div>
            <div className="field-label">Tools</div>
            <div className="field-value is-mute">
              Houdini · Nuke · Octane · Blender<br />
              USD / OpenUSD · Python<br />
              Resolve · Adobe Suite
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
